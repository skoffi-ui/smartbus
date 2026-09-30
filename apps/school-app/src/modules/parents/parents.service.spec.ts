import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { ParentsService } from './parents.service';
import { TenantService } from '../tenant/tenant.service';

interface ParentPersiste {
  id?: string;
  pinCode?: string;
}

describe('ParentsService — PIN hashé', () => {
  let service: ParentsService;
  let save: jest.Mock<Promise<ParentPersiste>, [ParentPersiste]>;
  let findOne: jest.Mock;
  let find: jest.Mock;

  beforeEach(async () => {
    save = jest.fn((valeur: ParentPersiste) =>
      Promise.resolve({ ...valeur, id: 'parent-1' }),
    );
    findOne = jest.fn();
    find = jest.fn();
    const repo = {
      find,
      findOne,
      create: jest.fn((valeur: ParentPersiste) => valeur),
      save,
      remove: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentsService,
        {
          provide: TenantService,
          useValue: {
            getDataSource: jest.fn(() =>
              Promise.resolve({ getRepository: () => repo }),
            ),
          },
        },
      ],
    }).compile();
    service = module.get(ParentsService);
  });

  it("n'enregistre pas le PIN en clair et ne le renvoie qu'une fois", async () => {
    findOne.mockResolvedValue(null);

    const cree = await service.create({
      firstName: 'Awa',
      lastName: 'Koné',
      phone: '+22501020304',
      pinCode: '1234',
    });

    const stocke = save.mock.calls[0][0].pinCode ?? '';
    expect(stocke).not.toBe('1234');
    expect(stocke.startsWith('$2b$12$')).toBe(true);
    expect(await bcrypt.compare('1234', stocke)).toBe(true);
    expect(cree.pinCode).toBe('1234');
  });

  it('ne renvoie pas le hash dans la liste', async () => {
    const hash = await bcrypt.hash('1234', 12);
    find.mockResolvedValue([
      { id: 'parent-1', firstName: 'Awa', pinCode: hash },
    ]);

    const liste = await service.findAll();

    expect(liste[0].pinCode).toBeUndefined();
    expect(JSON.stringify(liste)).not.toContain(hash);
    expect(JSON.stringify(liste)).not.toContain('1234');
  });

  it('hashe aussi un PIN modifié', async () => {
    findOne.mockResolvedValue({
      id: 'parent-1',
      phone: '+22501020304',
      pinCode: 'ancien',
    });

    const resultat = await service.update('parent-1', { pinCode: '5678' });

    const stocke = save.mock.calls[0][0].pinCode ?? '';
    expect(stocke).not.toBe('5678');
    expect(await bcrypt.compare('5678', stocke)).toBe(true);
    expect(resultat.pinCode).toBeUndefined();
  });
});
