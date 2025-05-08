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
  private isAnimating = useRideStore.getState().isAnimating;
  private movementDisabledMessageText: Phaser.GameObjects.Text | null = null;
  private unsubscribe: (() => void) | null = null;

  // Configurable rider scale and vertical position
  private readonly riderScale = 0.83; // Adjusted for 144px sprites (was 2.5 for 48px sprites)
  private readonly riderYPercent = 0.65; // Change this value to move the rider up/down (0 = top, 1 = bottom)
  private readonly bgYOffset = -240; // Change this value to move the background up/down
  private readonly bgScale = 1; // Change this value to scale the background

  constructor() {
    super({ key: 'RideScene' });
  }

  create() {
    // Full-canvas scrolling background
    const bgHeight = this.scale.height - this.bgYOffset;
    this.bg = this.add
      .tileSprite(0, this.bgYOffset, this.scale.width, bgHeight, 'bg')
      .setOrigin(0, 0)
      .setScale(this.bgScale);

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
        .sprite(180, this.scale.height * this.riderYPercent, 'rider')
        .setScale(this.riderScale);
      
      // Only start animation if isAnimating is true
      if (this.isAnimating) {
        this.rider.play('ride');
      }
    } catch (error) {
      console.error('Error creating rider sprite:', error);
      return;
    }

    // Cursor keys helper
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard not available');
    this.cursors = keyboard.createCursorKeys();

    // Set up store subscription after scene is initialized
    let currentMovementDisabledMessage = useRideStore.getState().movementDisabledMessage;
    
    this.unsubscribe = useRideStore.subscribe((state) => {
      const newIsAnimating = state.isAnimating;
      if (this.isAnimating !== newIsAnimating) {
        this.isAnimating = newIsAnimating;
        // Reset distance when starting a new ride
        if (newIsAnimating) {
          this.distanceFeet = 0;
          this.setDistance(0);
        }
        // Update animation state if rider exists
        if (this.rider) {
          if (newIsAnimating && this.cursors.right?.isDown) {
            this.rider.play('ride');
          } else {
            this.rider.stop();
          }
        }
        // Update message display when animation state changes
        this.updateDisabledMessageDisplay(state.movementDisabledMessage);
      }

      // Handle movement disabled message changes
      if (currentMovementDisabledMessage !== state.movementDisabledMessage) {
        currentMovementDisabledMessage = state.movementDisabledMessage;
        this.updateDisabledMessageDisplay(currentMovementDisabledMessage);
      }
    });

    // Clean up subscription when scene is destroyed
    this.events.on('destroy', () => {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    });
  }

  private updateDisabledMessageDisplay(message: string | null) {
    if (this.movementDisabledMessageText) {
      this.movementDisabledMessageText.destroy();
      this.movementDisabledMessageText = null;
    }

    if (message && !this.isAnimating) {
      this.movementDisabledMessageText = this.add.text(
        this.scale.width * 0.2,
        this.scale.height / 4,
        message,
        { 
          font: '18px Arial',
          color: '#ffffff', 
          backgroundColor: '#000000aa',
          padding: { x: 10, y: 5 },
          align: 'center' 
        }
      ).setOrigin(0.5).setDepth(100);
    }
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

  update(_: number, delta: number) {
    // Only allow movement and animation if isAnimating is true
    if (!this.isAnimating || !this.cursors.right?.isDown) {
      if (this.rider.anims.isPlaying) {
        this.rider.stop();
      }
      return;
    }

    // Start animation if it's not already playing
    if (!this.rider.anims.isPlaying) {
      this.rider.play('ride');
    }

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
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.NO_CENTER
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
