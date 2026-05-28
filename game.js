(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const powerEl = document.createElement("span");

  powerEl.id = "power";
  powerEl.textContent = "Power: None";
  livesEl.insertAdjacentElement("afterend", powerEl);

  const Game = {
    width: canvas.width,
    height: canvas.height,
    state: "start",
    score: 0,
    lives: 3,
    lastTime: 0,
    spawnTimer: 0,
    fireCooldown: 0,
    elapsedTime: 0,
    kills: 0,
    bossSpawned: false,
    bossActive: false,
    keys: Object.create(null),
    stars: [],
    player: {
      x: canvas.width / 2 - 18,
      y: canvas.height - 76,
      w: 36,
      h: 44,
      speed: 285
    },
    bullets: [],
    enemyBullets: [],
    enemies: [],
    powerUps: [],
    spreadTimer: 0,
    shield: false,
    enemyTypes: [
      { name: "basic", w: 34, h: 32, speed: 95, hp: 1, score: 100, color: "#4db5ff" },
      { name: "fast", w: 24, h: 24, speed: 170, hp: 1, score: 150, color: "#ffe05c" },
      { name: "tank", w: 52, h: 44, speed: 70, hp: 3, score: 300, color: "#8f6bff" }
    ],

    init() {
      this.makeStars();
      this.bindInput();
      this.updateHud();
      requestAnimationFrame((time) => this.loop(time));
    },

    reset() {
      this.state = "playing";
      this.score = 0;
      this.lives = 3;
      this.spawnTimer = 0;
      this.fireCooldown = 0;
      this.elapsedTime = 0;
      this.kills = 0;
      this.bossSpawned = false;
      this.bossActive = false;
      this.bullets.length = 0;
      this.enemyBullets.length = 0;
      this.enemies.length = 0;
      this.powerUps.length = 0;
      this.spreadTimer = 0;
      this.shield = false;
      this.player.x = this.width / 2 - this.player.w / 2;
      this.player.y = this.height - 76;
      this.updateHud();
    },

    makeStars() {
      this.stars.length = 0;
      for (let i = 0; i < 95; i += 1) {
        this.stars.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          r: Math.random() * 1.5 + 0.4,
          speed: Math.random() * 24 + 12
        });
      }
    },

    bindInput() {
      window.addEventListener("keydown", (event) => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(event.code)) {
          event.preventDefault();
        }

        this.keys[event.code] = true;

        if ((this.state === "start" && event.code === "Space") || event.code === "Enter") {
          this.reset();
        }

        if (this.state === "gameover" && event.code === "KeyR") {
          this.reset();
        }
      });

      window.addEventListener("keyup", (event) => {
        this.keys[event.code] = false;
      });
    },

    loop(time) {
      const delta = Math.min((time - this.lastTime) / 1000 || 0, 0.033);
      this.lastTime = time;

      this.update(delta);
      this.draw();

      requestAnimationFrame((nextTime) => this.loop(nextTime));
    },

    update(delta) {
      this.updateStars(delta);

      if (this.state !== "playing") {
        return;
      }

      this.movePlayer(delta);
      this.updateBullets(delta);
      this.updateEnemyBullets(delta);
      this.updateEnemies(delta);
      this.updatePowerUps(delta);
      this.elapsedTime += delta;
      this.spreadTimer = Math.max(0, this.spreadTimer - delta);

      if (!this.bossSpawned && (this.elapsedTime >= 60 || this.kills >= 30)) {
        this.spawnBoss();
      }

      if (!this.bossActive) {
        this.spawnTimer += delta * 1000;

        if (this.spawnTimer >= 800) {
          this.spawnTimer = 0;
          this.spawnEnemy();
        }
      }

      this.handleCollisions();
      this.updateHud();
    },

    updateStars(delta) {
      for (const star of this.stars) {
        star.y += star.speed * delta;
        if (star.y > this.height) {
          star.x = Math.random() * this.width;
          star.y = -2;
        }
      }
    },

    movePlayer(delta) {
      let dx = 0;
      let dy = 0;

      if (this.keys.ArrowLeft) dx -= 1;
      if (this.keys.ArrowRight) dx += 1;
      if (this.keys.ArrowUp) dy -= 1;
      if (this.keys.ArrowDown) dy += 1;

      if (dx !== 0 && dy !== 0) {
        dx *= Math.SQRT1_2;
        dy *= Math.SQRT1_2;
      }

      this.player.x = this.clamp(this.player.x + dx * this.player.speed * delta, 0, this.width - this.player.w);
      this.player.y = this.clamp(this.player.y + dy * this.player.speed * delta, 0, this.height - this.player.h);

      this.fireCooldown -= delta;
      if (this.keys.Space && this.fireCooldown <= 0) {
        this.fireBullet();
        this.fireCooldown = 0.18;
      }
    },

    fireBullet() {
      const centerX = this.player.x + this.player.w / 2 - 3;
      const originY = this.player.y - 12;
      const shots = this.spreadTimer > 0 ? [-145, 0, 145] : [0];

      for (const vx of shots) {
        this.bullets.push({
          x: centerX,
          y: originY,
          w: 6,
          h: 16,
          vx,
          vy: -430
        });
      }
    },

    updateBullets(delta) {
      for (const bullet of this.bullets) {
        bullet.x += (bullet.vx || 0) * delta;
        bullet.y += (bullet.vy || -bullet.speed) * delta;
      }
      this.bullets = this.bullets.filter((bullet) => (
        bullet.y + bullet.h > 0 &&
        bullet.x + bullet.w > 0 &&
        bullet.x < this.width
      ));
    },

    updateEnemyBullets(delta) {
      for (const bullet of this.enemyBullets) {
        bullet.x += bullet.vx * delta;
        bullet.y += bullet.vy * delta;
      }

      this.enemyBullets = this.enemyBullets.filter((bullet) => (
        bullet.y < this.height + bullet.h &&
        bullet.x + bullet.w > 0 &&
        bullet.x < this.width
      ));
    },

    updateEnemies(delta) {
      for (const enemy of this.enemies) {
        if (enemy.isBoss) {
          enemy.y = Math.min(enemy.y + enemy.speed * delta, 42);
          enemy.x += enemy.vx * delta;
          if (enemy.x <= 0 || enemy.x + enemy.w >= this.width) {
            enemy.x = this.clamp(enemy.x, 0, this.width - enemy.w);
            enemy.vx *= -1;
          }

          enemy.fireTimer -= delta;
          if (enemy.fireTimer <= 0) {
            this.fireBossPattern(enemy);
            enemy.fireTimer = 1.25;
          }
          continue;
        }

        enemy.y += enemy.speed * delta;
      }

      this.enemies = this.enemies.filter((enemy) => {
        if (enemy.isBoss) {
          return true;
        }
        if (enemy.y <= this.height) {
          return true;
        }
        this.loseLife();
        return false;
      });
    },

    updatePowerUps(delta) {
      for (const powerUp of this.powerUps) {
        powerUp.y += powerUp.speed * delta;
        powerUp.spin += delta * 6;
      }

      this.powerUps = this.powerUps.filter((powerUp) => powerUp.y <= this.height + powerUp.h);
    },

    spawnEnemy() {
      const roll = Math.random();
      const type = roll < 0.58 ? this.enemyTypes[0] : roll < 0.84 ? this.enemyTypes[1] : this.enemyTypes[2];

      this.enemies.push({
        name: type.name,
        x: Math.random() * (this.width - type.w),
        y: -type.h,
        w: type.w,
        h: type.h,
        speed: type.speed,
        hp: type.hp,
        maxHp: type.hp,
        score: type.score,
        color: type.color
      });
    },

    spawnBoss() {
      this.bossSpawned = true;
      this.bossActive = true;
      this.spawnTimer = 0;
      this.enemies.length = 0;
      this.enemyBullets.length = 0;

      this.enemies.push({
        name: "boss",
        isBoss: true,
        x: this.width / 2 - 72,
        y: -96,
        w: 144,
        h: 82,
        speed: 58,
        vx: 118,
        hp: 30,
        maxHp: 30,
        score: 500,
        color: "#ff4f7d",
        fireTimer: 0.8
      });
    },

    fireBossPattern(boss) {
      const centerX = boss.x + boss.w / 2 - 4;
      const startY = boss.y + boss.h - 4;
      const spread = [-150, -75, 0, 75, 150];

      for (const vx of spread) {
        this.enemyBullets.push({
          x: centerX,
          y: startY,
          w: 8,
          h: 14,
          vx,
          vy: 205
        });
      }
    },

    dropPowerUp(enemy) {
      if (enemy.isBoss || Math.random() >= 0.05) {
        return;
      }

      const type = Math.random() < 0.5 ? "spread" : "shield";
      this.powerUps.push({
        type,
        x: enemy.x + enemy.w / 2 - 9,
        y: enemy.y + enemy.h / 2 - 9,
        w: 18,
        h: 18,
        speed: 95,
        spin: 0
      });
    },

    handleCollisions() {
      for (let bulletIndex = this.bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
        const bullet = this.bullets[bulletIndex];

        for (let enemyIndex = this.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
          const enemy = this.enemies[enemyIndex];
          if (!this.intersects(bullet, enemy)) {
            continue;
          }

          this.bullets.splice(bulletIndex, 1);
          enemy.hp -= 1;

          if (enemy.hp <= 0) {
            this.enemies.splice(enemyIndex, 1);
            this.score += enemy.score;
            if (enemy.isBoss) {
              this.bossActive = false;
              this.spawnTimer = 650;
            } else {
              this.kills += 1;
              this.dropPowerUp(enemy);
            }
          }
          break;
        }
      }

      for (let bulletIndex = this.enemyBullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
        if (this.intersects(this.player, this.enemyBullets[bulletIndex])) {
          this.enemyBullets.splice(bulletIndex, 1);
          this.takeHit();
        }
      }

      for (let powerIndex = this.powerUps.length - 1; powerIndex >= 0; powerIndex -= 1) {
        const powerUp = this.powerUps[powerIndex];
        if (!this.intersects(this.player, powerUp)) {
          continue;
        }

        this.powerUps.splice(powerIndex, 1);
        if (powerUp.type === "spread") {
          this.spreadTimer = 8;
        } else {
          this.shield = true;
        }
      }

      for (let enemyIndex = this.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
        if (this.intersects(this.player, this.enemies[enemyIndex])) {
          if (this.enemies[enemyIndex].isBoss) {
            this.takeHit();
            continue;
          }
          this.enemies.splice(enemyIndex, 1);
          this.takeHit();
        }
      }
    },

    takeHit() {
      if (this.shield) {
        this.shield = false;
        this.updateHud();
        return;
      }

      this.loseLife();
    },

    loseLife() {
      if (this.state !== "playing") {
        return;
      }

      this.lives -= 1;
      if (this.lives <= 0) {
        this.lives = 0;
        this.state = "gameover";
      }
      this.updateHud();
    },

    intersects(a, b) {
      return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
      );
    },

    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },

    updateHud() {
      scoreEl.textContent = `Score: ${this.score}`;
      livesEl.textContent = `Lives: ${this.lives}`;
      if (this.spreadTimer > 0 && this.shield) {
        powerEl.textContent = `Power: Spread ${this.spreadTimer.toFixed(1)}s | Shield`;
      } else if (this.spreadTimer > 0) {
        powerEl.textContent = `Power: Spread ${this.spreadTimer.toFixed(1)}s`;
      } else if (this.shield) {
        powerEl.textContent = "Power: Shield";
      } else {
        powerEl.textContent = "Power: None";
      }
    },

    draw() {
      this.drawBackground();
      this.drawPowerUps();
      this.drawBullets();
      this.drawEnemyBullets();
      this.drawEnemies();
      this.drawPlayer();
      this.drawBossHud();

      if (this.state === "start") {
        this.drawOverlay("PLANE STRIKE", "Press Space or Enter to start");
      } else if (this.state === "gameover") {
        this.drawOverlay("GAME OVER", `Final Score: ${this.score}  •  Press R to restart`);
      }
    },

    drawBackground() {
      ctx.fillStyle = "#030612";
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = "#ffffff";
      for (const star of this.stars) {
        ctx.globalAlpha = 0.45 + star.r / 3;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    drawPlayer() {
      const p = this.player;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(p.x + p.w / 2, p.y);
      ctx.lineTo(p.x + p.w, p.y + p.h);
      ctx.lineTo(p.x + p.w / 2, p.y + p.h - 11);
      ctx.lineTo(p.x, p.y + p.h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#63c7ff";
      ctx.fillRect(p.x + p.w / 2 - 4, p.y + p.h - 10, 8, 13);

      if (this.shield) {
        ctx.strokeStyle = "rgba(87, 255, 201, 0.82)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 31, 0, Math.PI * 2);
        ctx.stroke();
      }
    },

    drawBullets() {
      ctx.fillStyle = "#ff2d2d";
      for (const bullet of this.bullets) {
        ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
      }
    },

    drawEnemyBullets() {
      ctx.fillStyle = "#ff9b42";
      for (const bullet of this.enemyBullets) {
        ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
      }
    },

    drawPowerUps() {
      for (const powerUp of this.powerUps) {
        const cx = powerUp.x + powerUp.w / 2;
        const cy = powerUp.y + powerUp.h / 2;
        const radius = powerUp.w / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(powerUp.spin);
        ctx.fillStyle = powerUp.type === "spread" ? "#ff4fd8" : "#57ffc9";
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.lineTo(radius, 0);
        ctx.lineTo(0, radius);
        ctx.lineTo(-radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    },

    drawEnemies() {
      for (const enemy of this.enemies) {
        ctx.fillStyle = enemy.color;
        ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);

        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fillRect(enemy.x + 5, enemy.y + 6, enemy.w - 10, 5);

        if (enemy.maxHp > 1) {
          ctx.fillStyle = "#59ff79";
          ctx.fillRect(enemy.x + 5, enemy.y + 6, (enemy.w - 10) * (enemy.hp / enemy.maxHp), 5);
        }
      }
    },

    drawBossHud() {
      const boss = this.enemies.find((enemy) => enemy.isBoss);
      if (!boss) {
        return;
      }

      const barX = 60;
      const barY = 16;
      const barW = this.width - 120;
      const barH = 13;

      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = "#ff4f7d";
      ctx.fillRect(barX, barY, barW * (boss.hp / boss.maxHp), barH);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barW, barH);

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.font = "700 14px Arial, Helvetica, sans-serif";
      ctx.fillText(`BOSS HP ${boss.hp}/${boss.maxHp}`, this.width / 2, barY - 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    },

    drawOverlay(title, subtitle) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.74)";
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 42px Arial, Helvetica, sans-serif";
      ctx.fillText(title, this.width / 2, this.height / 2 - 28);

      ctx.font = "18px Arial, Helvetica, sans-serif";
      ctx.fillStyle = "#b8c7ff";
      ctx.fillText(subtitle, this.width / 2, this.height / 2 + 24);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  };

  Game.init();
}());
