export interface FindOne {
  (params: HeroById): Promise<Hero>;
}

export interface HeroById {
  id: number;
}

export interface Hero {
  id: number;
  name: string;
}

export interface HeroesService {
  findOne: FindOne;
}
