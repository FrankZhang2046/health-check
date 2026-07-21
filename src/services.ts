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
  {
    id: 'pillow-chat',
    name: 'Pillow Chat',
    url: 'https://pillowchat.app/healthCheck',
  },
];
