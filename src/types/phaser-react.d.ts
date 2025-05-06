declare module 'phaser-react' {
  import { GameConfig } from 'phaser';
  import { FC } from 'react';

  interface PhaserGameProps {
    game: GameConfig;
  }

  export const PhaserGame: FC<PhaserGameProps>;
} 