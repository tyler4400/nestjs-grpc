import { Controller, Get, Inject, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Hero, HeroesService } from './interfaces/hero.interface';
import { Observable } from 'rxjs';

@Controller()
export class AppController implements OnModuleInit {
  private heroService: HeroesService;

  constructor(@Inject('HERO_PACKAGE') private client: ClientGrpc) {}

  onModuleInit() {
    this.heroService = this.client.getService<HeroesService>('HeroService');
  }

  @Get()
  getHello(): Promise<Hero> {
    return this.heroService.findOne({ id: 2 });
  }
}
