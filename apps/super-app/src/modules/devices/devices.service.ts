import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface DeviceData {
  serial_number: string;
  type_device: string;
  status?: string;
  imei?: string;
}

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Récupère la liste de tous les équipements et l'organisation à laquelle ils sont affectés.
   */
  async findAll() {
    const query = `
      SELECT 
        d.id, 
        d.serial_number, 
        d.type_device, 
        d.status, 
        d.last_seen_at,
        d.created_at,
        d.imei,
        od.organisation_id as assigned_organisation_id,
        o.name as assigned_organisation_name
      FROM devices d
      LEFT JOIN organisation_devices od ON od.device_id = d.id AND od.released_at IS NULL
      LEFT JOIN organisations o ON o.id = od.organisation_id
      WHERE d.deleted_at IS NULL
      ORDER BY d.created_at DESC
    `;
    const devices = await this.dataSource.query(query);
    return devices;
  }

  /**
   * Enregistre un nouvel équipement manuellement.
   */
  async create(data: DeviceData) {
    const { serial_number, type_device, status = 'ACTIVE', imei } = data;

    const cleanImei = imei && imei.trim() !== '' ? imei.trim() : null;

    // Check if it already exists
    const checkQuery = `SELECT id FROM devices WHERE serial_number = $1 AND deleted_at IS NULL`;
    const existing = await this.dataSource.query(checkQuery, [serial_number]);
    if (existing.length > 0) {
      throw new Error(
        `Device with serial number ${serial_number} already exists`,
      );
    }

    const query = `
      INSERT INTO devices (serial_number, type_device, status, imei)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await this.dataSource.query(query, [
      serial_number,
      type_device,
      status,
      cleanImei,
    ]);
    return result[0];
  }

  /**
   * Supprime un équipement (soft delete).
   */
  async remove(id: string) {
    // Release any active assignment first
    await this.release(id);
    const query = `UPDATE devices SET deleted_at = NOW() WHERE id = $1`;
    await this.dataSource.query(query, [id]);
    return { success: true };
  }

  /**
   * Assigne un équipement à une organisation.
   */
  async assign(deviceId: string, organisationId: string) {
    // First check if device exists
    const deviceCheck = await this.dataSource.query(
      `SELECT id FROM devices WHERE id = $1 AND deleted_at IS NULL`,
      [deviceId],
    );
    if (deviceCheck.length === 0) {
      throw new NotFoundException('Device not found');
    }

    // Release any current assignment
    await this.release(deviceId);

    // Create new assignment
    const query = `
      INSERT INTO organisation_devices (device_id, organisation_id, assigned_at)
      VALUES ($1, $2, NOW())
      RETURNING *
    `;
    const result = await this.dataSource.query(query, [
      deviceId,
      organisationId,
    ]);
    return result[0];
  }

  /**
   * Libère un équipement de son organisation actuelle.
   */
  async release(deviceId: string) {
    const query = `
      UPDATE organisation_devices 
      SET released_at = NOW() 
      WHERE device_id = $1 AND released_at IS NULL
    `;
    await this.dataSource.query(query, [deviceId]);
    return { success: true };
  }
}
