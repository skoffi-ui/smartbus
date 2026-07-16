import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '@app/database';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll() {
    return this.userRepository.find({
      select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, lastLoginAt: true, createdAt: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async create(data: Partial<User>) {
    const existing = await this.userRepository.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Cet email est déjà utilisé');

    const hashedPassword = await bcrypt.hash(data.password || 'Password123!', 12);
    const user = this.userRepository.create({
      ...data,
      password: hashedPassword,
    });
    return this.userRepository.save(user);
  }

  async toggleStatus(id: string) {
    const user = await this.findOne(id);
    user.status = user.status === UserStatus.ACTIVE ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
    return this.userRepository.save(user);
  }
}
