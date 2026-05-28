(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");

  const Game = {
    width: canvas.width,
    height: canvas.height,
    state: "start",
    score: 0,
    lives: 3,
    lastTime: 0,
    spawnTimer: 0,
    fireCooldown: 0,
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
    enemies: [],
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
      this.bullets.length = 0;
      this.enemies.length = 0;
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
      this.updateEnemies(delta);
      this.spawnTimer += delta * 1000;

      if (this.spawnTimer >= 800) {
        this.spawnTimer = 0;
        this.spawnEnemy();
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
      this.bullets.push({
        x: this.player.x + this.player.w / 2 - 3,
        y: this.player.y - 12,
        w: 6,
        h: 16,
        speed: 430
      });
    },

    updateBullets(delta) {
      for (const bullet of this.bullets) {
        bullet.y -= bullet.speed * delta;
      }
      this.bullets = this.bullets.filter((bullet) => bullet.y + bullet.h > 0);
    },

    updateEnemies(delta) {
      for (const enemy of this.enemies) {
        enemy.y += enemy.speed * delta;
      }

      this.enemies = this.enemies.filter((enemy) => {
        if (enemy.y <= this.height) {
          return true;
        }
        this.loseLife();
        return false;
      });
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
          }
          break;
        }
      }

      for (let enemyIndex = this.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
        if (this.intersects(this.player, this.enemies[enemyIndex])) {
          this.enemies.splice(enemyIndex, 1);
          this.loseLife();
        }
      }
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
    },

    draw() {
      this.drawBackground();
      this.drawBullets();
      this.drawEnemies();
      this.drawPlayer();

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
    },

    drawBullets() {
      ctx.fillStyle = "#ff2d2d";
      for (const bullet of this.bullets) {
        ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
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
