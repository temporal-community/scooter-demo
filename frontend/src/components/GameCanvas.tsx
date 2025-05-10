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
  private lastWorkflowId: string | null = useRideStore.getState().workflowId;

  // Configurable rider scale and vertical position
  private readonly riderScale = 1.245;
  private readonly riderYPercent = 0.4;
  private readonly bgYOffset = -240;
  private readonly bgScale = 1;

  constructor() {
    super({ key: 'RideScene' });
  }

  create() {
    const bgHeight = this.scale.height - this.bgYOffset;
    this.bg = this.add
      .tileSprite(0, this.bgYOffset, this.scale.width, bgHeight, 'bg')
      .setOrigin(0, 0)
      .setScale(this.bgScale);

    if (!this.textures.exists('rider')) {
      console.error('Rider texture not found!');
      return;
    }

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

    try {
      this.rider = this.add
        .sprite(180, this.scale.height * this.riderYPercent, 'rider')
        .setScale(this.riderScale);
      
      if (this.isAnimating) {
        this.rider.play('ride');
      }
    } catch (error) {
      console.error('Error creating rider sprite:', error);
      return;
    }

    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard not available');
    this.cursors = keyboard.createCursorKeys();

    let currentMovementDisabledMessage: string | null = useRideStore.getState().movementDisabledMessage;
    // Initialize message display
    this.updateDisabledMessageDisplay(currentMovementDisabledMessage);
    
    this.unsubscribe = useRideStore.subscribe((state) => {
      const newIsAnimating = state.isAnimating;
      console.log('[RideScene subscribe] Store update. Phase from orchestrator (via isAnimating indirectly):', state.isAnimating ? 'Probably ACTIVE/INIT' : 'Probably NOT ACTIVE/INIT/BLOCKED', 'Received movementDisabledMessage:', state.movementDisabledMessage);
      
      if (state.workflowId !== this.lastWorkflowId) {
        this.lastWorkflowId = state.workflowId;
        if (state.workflowId !== null) { 
          this.distanceFeet = 0;
          this.setDistance(0);
        }
      }

      if (this.isAnimating !== newIsAnimating) {
        this.isAnimating = newIsAnimating;
        if (this.rider) {
          if (newIsAnimating && this.cursors.right?.isDown) {
            this.rider.play('ride');
          } else {
            this.rider.stop();
          }
        }
      }

      // Always update message display if it changes or if animation state changes,
      // as the message visibility criteria might depend on both.
      if (currentMovementDisabledMessage !== state.movementDisabledMessage || this.isAnimating !== newIsAnimating) {
        console.log('[RideScene subscribe] Message or anim changed. Updating display. Old msg:', currentMovementDisabledMessage, 'New msg:', state.movementDisabledMessage);
        currentMovementDisabledMessage = state.movementDisabledMessage;
        this.updateDisabledMessageDisplay(currentMovementDisabledMessage);
      }
    });

    this.events.on('destroy', () => {
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    });
  }

  private updateDisabledMessageDisplay(message: string | null) {
    // Clear existing message if any
    if (this.movementDisabledMessageText) {
      this.movementDisabledMessageText.destroy();
      this.movementDisabledMessageText = null;
    }

    // Display new message if it exists.
    // The message should be shown regardless of the animation state.
    // Actual movement is controlled by `this.isAnimating` in the `update` method.
    if (message) {
      this.movementDisabledMessageText = this.add.text(
        this.scale.width * 0.2,  // 20% of width
        this.scale.height / 6, // 1/6 from top
        message,
        { 
          font: '24px Helvetica',
          color: '#ffffff', 
          backgroundColor: '#000000aa',
          padding: { x: 15, y: 10 },
          align: 'center',
          wordWrap: { width: 200 },  // Add word wrap with max width
          lineSpacing: 5,            // Add some spacing between lines
          fixedWidth: 250,
        }
      ).setOrigin(0.5).setDepth(100); // Ensure it's on top
    }
  }

  preload() {
    this.load.image('bg', '/assets/bg.png');
    this.load.spritesheet('rider', '/assets/rider.png', {
      frameWidth: 144,
      frameHeight: 144,
    });

    this.load.on('loaderror', (file: any) => {
      console.error('Error loading file:', file.key);
    });
  }

  update(_: number, delta: number) {
    // Only allow movement and animation if isAnimating is true AND right arrow is pressed
    if (!this.isAnimating || !this.cursors.right?.isDown) {
      if (this.rider && this.rider.anims && this.rider.anims.isPlaying) {
        this.rider.stop();
      }
      return;
    }

    if (this.rider && this.rider.anims && !this.rider.anims.isPlaying) {
      this.rider.play('ride');
    }

    const dx = (delta / 1000) * 180;
    this.bg.tilePositionX += dx;
    this.distanceFeet += dx / 5;
    this.setDistance(this.distanceFeet);
  }
}

export default function GameCanvas() {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800, // Initial width, will be scaled by RESIZE
      height: 600, // Initial height, will be scaled by RESIZE
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
        autoCenter: Phaser.Scale.NO_CENTER
      }
    };

    gameRef.current = new Phaser.Game(config);

    // Handle window resize to ensure Phaser canvas rescales
    const handleResize = () => {
      if (gameRef.current) {
        // gameRef.current.scale.resize(window.innerWidth, window.innerHeight); // Not needed with FIT and autoCenter
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return <div id="game-container" className="w-full h-full" />
}