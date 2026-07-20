export interface Service {
  id: string;
  name: string;
  url: string;
}

export const SERVICES: Service[] = [
  {
    id: 'wordforge',
    name: 'Wordforge',
    url: 'https://us-central1-wordsmith-vocabulary-builder.cloudfunctions.net/healthCheck',
  },
];
