import Phaser from 'phaser';
import { ARENA_WIDTH, ARENA_HEIGHT, PLANE_IDS } from '@dogfight/shared';

export class BootScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBox!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;

  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.createLoadingUI();

    // 1. Load Plane Sprites (plane-1 through plane-11)
    for (const planeId of PLANE_IDS) {
      this.load.image(planeId, `/assets/planes/${planeId}.png`);
    }

    // 2. Load Bullet Sprites
    this.load.image('bullet-1', '/assets/bullets/bullet-1.png');
    this.load.image('bullet-2', '/assets/bullets/bullet-2.png');
    this.load.image('bullet-3', '/assets/bullets/bullet-3.png');

    // 3. Load Background Cloud Packs (Clouds 1 through Clouds 8)
    const cloudLayerCounts: Record<number, number> = {
      1: 4,
      2: 4,
      3: 4,
      4: 4,
      5: 5,
      6: 6,
      7: 4,
      8: 6
    };

    for (let pack = 1; pack <= 8; pack++) {
      const layerCount = cloudLayerCounts[pack] || 4;
      for (let layer = 1; layer <= layerCount; layer++) {
        this.load.image(
          `bg-clouds-${pack}-${layer}`,
          `/assets/backgrounds/Clouds ${pack}/${layer}.png`
        );
      }
    }

    // Listen to load events
    this.load.on('progress', (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0x38bdf8, 1);
      this.progressBar.fillRect(
        ARENA_WIDTH / 2 - 150,
        ARENA_HEIGHT / 2 - 10,
        300 * value,
        20
      );
      this.loadingText.setText(`PREPARING COMBAT SQUADRON... ${Math.round(value * 100)}%`);
    });

    this.load.on('complete', () => {
      this.progressBar.destroy();
      this.progressBox.destroy();
      this.loadingText.destroy();
    });
  }

  create(): void {
    // Generate procedural particle textures
    this.generateParticleTextures();

    // Ensure all loaded textures use crisp nearest-neighbor filtering
    this.textures.each((texture: Phaser.Textures.Texture) => {
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }, this);

    // Transition smoothly into ArenaScene
    this.scene.start('ArenaScene');
  }

  private createLoadingUI(): void {
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x0f172a, 0.8);
    this.progressBox.lineStyle(2, 0x38bdf8, 0.8);
    this.progressBox.strokeRect(ARENA_WIDTH / 2 - 155, ARENA_HEIGHT / 2 - 15, 310, 30);
    this.progressBox.fillRect(ARENA_WIDTH / 2 - 155, ARENA_HEIGHT / 2 - 15, 310, 30);

    this.progressBar = this.add.graphics();

    this.loadingText = this.add.text(
      ARENA_WIDTH / 2,
      ARENA_HEIGHT / 2 - 35,
      'PREPARING COMBAT SQUADRON... 0%',
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '12px',
        color: '#38bdf8'
      }
    ).setOrigin(0.5);
  }

  private generateParticleTextures(): void {
    // 1. Engine smoke puff
    if (!this.textures.exists('particle-smoke')) {
      const canvas = this.textures.createCanvas('particle-smoke', 16, 16);
      if (canvas) {
        const ctx = canvas.getContext();
        const grad = ctx.createRadialGradient(8, 8, 2, 8, 8, 8);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        grad.addColorStop(0.5, 'rgba(203, 213, 225, 0.6)');
        grad.addColorStop(1, 'rgba(148, 163, 184, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(8, 8, 8, 0, Math.PI * 2);
        ctx.fill();
        canvas.refresh();
      }
    }

    // 2. Orange/Yellow spark
    if (!this.textures.exists('particle-spark')) {
      const canvas = this.textures.createCanvas('particle-spark', 6, 6);
      if (canvas) {
        const ctx = canvas.getContext();
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(1, 1, 4, 4);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(2, 2, 2, 2);
        canvas.refresh();
      }
    }

    // 3. Debris fragment for plane destruction
    if (!this.textures.exists('particle-debris')) {
      const canvas = this.textures.createCanvas('particle-debris', 8, 8);
      if (canvas) {
        const ctx = canvas.getContext();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(1, 1, 6, 6);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(2, 2, 4, 4);
        canvas.refresh();
      }
    }

    // 4. Muzzle flash
    if (!this.textures.exists('particle-flash')) {
      const canvas = this.textures.createCanvas('particle-flash', 12, 12);
      if (canvas) {
        const ctx = canvas.getContext();
        const grad = ctx.createRadialGradient(6, 6, 1, 6, 6, 6);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.4, 'rgba(251, 191, 36, 0.9)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(6, 6, 6, 0, Math.PI * 2);
        ctx.fill();
        canvas.refresh();
      }
    }

    // 5. Shockwave ring
    if (!this.textures.exists('particle-shockwave')) {
      const canvas = this.textures.createCanvas('particle-shockwave', 48, 48);
      if (canvas) {
        const ctx = canvas.getContext();
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(24, 24, 20, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(254, 240, 138, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(24, 24, 21, 0, Math.PI * 2);
        ctx.stroke();
        canvas.refresh();
      }
    }
  }
}
