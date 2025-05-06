// src/components/GameCanvas.tsx
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { useRideStore } from '../stores/rideStore';

/**
 * Single playable scene: scrolls right while → is held.
 * It updates the Zustand store with travelled km.
 */
class RideScene extends Phaser.Scene {
  private rider!: Phaser.GameObjects.Sprite;
  private bg!: Phaser.GameObjects.TileSprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private distanceFeet = 0;
  private readonly setDistance = useRideStore.getState().setDistance;

  // Configurable rider scale and vertical position
  private readonly riderScale = 0.83; // Adjusted for 144px sprites (was 2.5 for 48px sprites)
  private readonly riderYPercent = 0.65; // Change this value to move the rider up/down (0 = top, 1 = bottom)

  constructor() {
    super({ key: 'RideScene' });
  }

  preload() {
    // Swap these paths for your own sprite sheet / background
    this.load.image('bg', '/assets/bg.png');
    this.load.spritesheet('rider', '/assets/rider.png', {
      frameWidth: 144,
      frameHeight: 144,
    });

    // Add loading error handlers
    this.load.on('loaderror', (file: any) => {
      console.error('Error loading file:', file.key);
    });
  }

  create() {
    // Full-canvas scrolling background
    this.bg = this.add
      .tileSprite(0, 0, this.scale.width, this.scale.height, 'bg')
      .setOrigin(0);

    // Check if the rider texture exists
    if (!this.textures.exists('rider')) {
      console.error('Rider texture not found!');
      return;
    }

    // Create animation with error handling
    try {
      this.anims.create({
        key: 'ride',
        frames: this.anims.generateFrameNumbers('rider', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1,
      });
    } catch (error) {
      console.error('Error creating animation:', error);
      return;
    }

    // Create rider sprite with error handling
    try {
      this.rider = this.add
        .sprite(80, this.scale.height * this.riderYPercent, 'rider')
        .setScale(this.riderScale)
        .play('ride');
    } catch (error) {
      console.error('Error creating rider sprite:', error);
      return;
    }

    // Cursor keys helper
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard not available');
    this.cursors = keyboard.createCursorKeys();
  }

  update(_: number, delta: number) {
    if (!this.cursors.right?.isDown) return;

    // Move 180 px per second → tweak as you like
    const dx = (delta / 1000) * 180;
    // Keep rider in fixed position, only scroll background
    this.bg.tilePositionX += dx;

    // 100 px ≈ 20 feet (more realistic scale)
    this.distanceFeet += dx / 5;
    this.setDistance(this.distanceFeet);
  }
}

/**
 * React wrapper: renders the Phaser canvas full-width / height.
 */
export default function GameCanvas() {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      backgroundColor: '#87ceeb',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 }
        }
      },
      scene: RideScene,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      }
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return <div id="game-container" className="w-full h-full" />;
}
