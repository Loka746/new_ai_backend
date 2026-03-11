class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreElement = document.getElementById('score');
        this.gameOverScreen = document.getElementById('game-over');
        this.restartBtn = document.getElementById('restart-btn');

        this.gridSize = 20;
        this.tileCount = this.canvas.width / this.gridSize;
        
        // Load high score from local storage
        this.highScore = localStorage.getItem('snakeHighScore') || 0;
        document.getElementById('high-score').innerText = this.highScore;

        this.bindEvents();
        this.resetGame();
    }

    bindEvents() {
        this.restartBtn.addEventListener('click', () => this.resetGame());
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }

    resetGame() {
        // Initial snake state (starts with length 1 in the middle)
        this.snake = [
            { x: Math.floor(this.tileCount / 2), y: Math.floor(this.tileCount / 2) }
        ];
        this.velocity = { x: 0, y: 0 };
        this.score = 0;
        this.gameOver = false;
        
        this.food = this.generateFood();
        this.updateScore();
        this.gameOverScreen.classList.add('hidden');
        
        if (this.gameLoop) clearInterval(this.gameLoop);
        // Run game at 10 frames per second
        this.gameLoop = setInterval(() => this.update(), 1000 / 10);
        this.draw(); // Initial draw
    }

    generateFood() {
        let newFood;
        while (true) {
            newFood = {
                x: Math.floor(Math.random() * this.tileCount),
                y: Math.floor(Math.random() * this.tileCount)
            };
            // Ensure food doesn't spawn on the snake's body
            const onSnake = this.snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
            if (!onSnake) break;
        }
        return newFood;
    }

    handleKeyPress(e) {
        // Prevent default scrolling for arrow keys
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
            e.preventDefault();
        }

        // Prevent 180-degree turns (suicide)
        switch (e.key) {
            case 'ArrowUp':
                if (this.velocity.y !== 1) this.velocity = { x: 0, y: -1 };
                break;
            case 'ArrowDown':
                if (this.velocity.y !== -1) this.velocity = { x: 0, y: 1 };
                break;
            case 'ArrowLeft':
                if (this.velocity.x !== 1) this.velocity = { x: -1, y: 0 };
                break;
            case 'ArrowRight':
                if (this.velocity.x !== -1) this.velocity = { x: 1, y: 0 };
                break;
        }
    }

    update() {
        if (this.gameOver) return;

        // Calculate new head position
        const head = { 
            x: this.snake[0].x + this.velocity.x, 
            y: this.snake[0].y + this.velocity.y 
        };

        // Game hasn't started moving yet
        if (this.velocity.x === 0 && this.velocity.y === 0) return;

        // Check wall collision
        if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
            this.handleGameOver();
            return;
        }

        // Check self collision
        if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            this.handleGameOver();
            return;
        }

        // Move snake forward
        this.snake.unshift(head);

        // Check food collision
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            this.updateScore();
            this.food = this.generateFood();
        } else {
            // Remove tail if no food eaten
            this.snake.pop();
        }

        this.draw();
    }

    handleGameOver() {
        this.gameOver = true;
        clearInterval(this.gameLoop);
        
        // Handle High Score
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('snakeHighScore', this.highScore);
            document.getElementById('high-score').innerText = this.highScore;
        }
        
        this.gameOverScreen.classList.remove('hidden');
    }

    updateScore() {
        this.scoreElement.innerText = this.score;
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw food (Circle)
        this.ctx.fillStyle = '#f44336';
        this.ctx.beginPath();
        this.ctx.arc(
            this.food.x * this.gridSize + this.gridSize / 2, 
            this.food.y * this.gridSize + this.gridSize / 2, 
            this.gridSize / 2 - 2, 
            0, 
            2 * Math.PI
        );
        this.ctx.fill();

        // Draw snake
        this.snake.forEach((segment, index) => {
            // Head is slightly brighter green
            this.ctx.fillStyle = index === 0 ? '#4caf50' : '#81c784';
            
            // Add a 1px gap between segments for a grid-like visual effect
            this.ctx.fillRect(
                segment.x * this.gridSize + 1, 
                segment.y * this.gridSize + 1, 
                this.gridSize - 2, 
                this.gridSize - 2
            );
        });
    }
}

// Initialize game when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    new SnakeGame();
});