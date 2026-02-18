import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';

const WIDTH = 60;
const HEIGHT = 20;
const PADDLE_HEIGHT = 4;
const TICK_RATE = 50; // ms
const WIN_SCORE = 5;

interface PongGameProps {
  onExit?: () => void;
}

interface BallState {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

interface ScoreState {
  left: number;
  right: number;
}

type GameState = 'start' | 'playing' | 'paused' | 'gameover';

export default function PongGame({ onExit }: PongGameProps) {
  const { exit } = useApp();
  const [gameState, setGameState] = useState<GameState>('start');
  const [score, setScore] = useState<ScoreState>({ left: 0, right: 0 });
  const [winner, setWinner] = useState<'player' | 'cpu' | null>(null);

  // Use refs for game state to avoid stale closures in the game loop
  const ballRef = useRef<BallState>({ x: WIDTH / 2, y: HEIGHT / 2, dx: 1, dy: 0.5 });
  const leftPaddleRef = useRef(HEIGHT / 2 - PADDLE_HEIGHT / 2);
  const rightPaddleRef = useRef(HEIGHT / 2 - PADDLE_HEIGHT / 2);
  const scoreRef = useRef<ScoreState>({ left: 0, right: 0 });

  // Render state (updated from refs during game loop)
  const [renderBall, setRenderBall] = useState(ballRef.current);
  const [renderLeftPaddle, setRenderLeftPaddle] = useState(leftPaddleRef.current);
  const [renderRightPaddle, setRenderRightPaddle] = useState(rightPaddleRef.current);

  const handleExit = useCallback(() => {
    if (onExit) {
      onExit();
    } else {
      exit();
    }
  }, [onExit, exit]);

  const resetBall = useCallback((direction: 1 | -1) => {
    ballRef.current = {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      dx: direction,
      dy: (Math.random() - 0.5) * 1.5,
    };
  }, []);

  const resetGame = useCallback(() => {
    ballRef.current = { x: WIDTH / 2, y: HEIGHT / 2, dx: 1, dy: 0.5 };
    leftPaddleRef.current = HEIGHT / 2 - PADDLE_HEIGHT / 2;
    rightPaddleRef.current = HEIGHT / 2 - PADDLE_HEIGHT / 2;
    scoreRef.current = { left: 0, right: 0 };
    setScore({ left: 0, right: 0 });
    setWinner(null);
    setRenderBall(ballRef.current);
    setRenderLeftPaddle(leftPaddleRef.current);
    setRenderRightPaddle(rightPaddleRef.current);
  }, []);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = setInterval(() => {
      const ball = ballRef.current;
      let { x, y, dx, dy } = ball;
      
      let newX = x + dx;
      let newY = y + dy;
      let newDx = dx;
      let newDy = dy;
      
      // Wall collision (top/bottom)
      if (newY <= 0) {
        newDy = Math.abs(dy);
        newY = 0;
      } else if (newY >= HEIGHT - 1) {
        newDy = -Math.abs(dy);
        newY = HEIGHT - 1;
      }

      const leftPaddle = leftPaddleRef.current;
      const rightPaddle = rightPaddleRef.current;

      // Left Paddle collision
      if (newX <= 2 && newX >= 1) {
        if (newY >= leftPaddle && newY <= leftPaddle + PADDLE_HEIGHT) {
          newDx = Math.abs(dx) * 1.05; // Slight speed increase
          newX = 2;
          const hitPos = (newY - leftPaddle) / PADDLE_HEIGHT;
          newDy = (hitPos - 0.5) * 2;
        }
      }

      // Right Paddle collision
      if (newX >= WIDTH - 3 && newX <= WIDTH - 2) {
        if (newY >= rightPaddle && newY <= rightPaddle + PADDLE_HEIGHT) {
          newDx = -Math.abs(dx) * 1.05; // Slight speed increase
          newX = WIDTH - 3;
          const hitPos = (newY - rightPaddle) / PADDLE_HEIGHT;
          newDy = (hitPos - 0.5) * 2;
        }
      }

      // Clamp ball speed
      const maxSpeed = 2.5;
      newDx = Math.max(-maxSpeed, Math.min(maxSpeed, newDx));
      newDy = Math.max(-maxSpeed, Math.min(maxSpeed, newDy));

      // Score logic - ball goes past paddles
      if (newX < 0) {
        const newScore = { ...scoreRef.current, right: scoreRef.current.right + 1 };
        scoreRef.current = newScore;
        setScore(newScore);
        
        if (newScore.right >= WIN_SCORE) {
          setWinner('cpu');
          setGameState('gameover');
          return;
        }
        resetBall(1);
        setRenderBall(ballRef.current);
        return;
      }
      
      if (newX > WIDTH) {
        const newScore = { ...scoreRef.current, left: scoreRef.current.left + 1 };
        scoreRef.current = newScore;
        setScore(newScore);
        
        if (newScore.left >= WIN_SCORE) {
          setWinner('player');
          setGameState('gameover');
          return;
        }
        resetBall(-1);
        setRenderBall(ballRef.current);
        return;
      }
      
      // AI for right paddle - follows ball with some delay/imperfection
      const aiCenter = rightPaddle + PADDLE_HEIGHT / 2;
      const aiSpeed = 0.8;
      if (aiCenter < newY - 1) {
        rightPaddleRef.current = Math.min(HEIGHT - PADDLE_HEIGHT, rightPaddle + aiSpeed);
      } else if (aiCenter > newY + 1) {
        rightPaddleRef.current = Math.max(0, rightPaddle - aiSpeed);
      }

      // Update ball position
      ballRef.current = { x: newX, y: newY, dx: newDx, dy: newDy };
      
      // Update render state
      setRenderBall(ballRef.current);
      setRenderLeftPaddle(leftPaddleRef.current);
      setRenderRightPaddle(rightPaddleRef.current);
    }, TICK_RATE);

    return () => clearInterval(timer);
  }, [gameState, resetBall]);

  // Input handling
  useInput((input, key) => {
    // Exit handling
    if (key.escape || input === 'q' || input === 'Q') {
      handleExit();
      return;
    }

    // Start/restart game
    if (gameState === 'start' || gameState === 'gameover') {
      if (key.return || input === ' ') {
        resetGame();
        setGameState('playing');
      }
      return;
    }

    // Pause handling
    if (gameState === 'playing' && (input === 'p' || input === 'P')) {
      setGameState('paused');
      return;
    }
    
    if (gameState === 'paused') {
      if (input === 'p' || input === 'P' || key.return || input === ' ') {
        setGameState('playing');
      }
      return;
    }

    // Paddle movement
    if (gameState === 'playing') {
      if (key.upArrow || input === 'w' || input === 'W') {
        leftPaddleRef.current = Math.max(0, leftPaddleRef.current - 2);
        setRenderLeftPaddle(leftPaddleRef.current);
      }
      if (key.downArrow || input === 's' || input === 'S') {
        leftPaddleRef.current = Math.min(HEIGHT - PADDLE_HEIGHT, leftPaddleRef.current + 2);
        setRenderLeftPaddle(leftPaddleRef.current);
      }
    }
  });

  // Render the game field
  const renderField = () => {
    const rows: React.ReactNode[] = [];
    const ballX = Math.round(renderBall.x);
    const ballY = Math.round(renderBall.y);

    for (let y = 0; y < HEIGHT; y++) {
      let row = '';
      for (let x = 0; x < WIDTH; x++) {
        if (ballX === x && ballY === y) {
          row += '●';
        } else if (x === 1 && y >= renderLeftPaddle && y < renderLeftPaddle + PADDLE_HEIGHT) {
          row += '█';
        } else if (x === WIDTH - 2 && y >= renderRightPaddle && y < renderRightPaddle + PADDLE_HEIGHT) {
          row += '█';
        } else if (x === Math.floor(WIDTH / 2)) {
          row += y % 2 === 0 ? '│' : ' ';
        } else {
          row += ' ';
        }
      }
      rows.push(<Text key={y}>{row}</Text>);
    }
    return rows;
  };

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
      {/* Title and Score */}
      <Box borderStyle="round" borderColor="cyan" paddingX={2} marginBottom={1}>
        <Text bold color="cyan">🏓 PONG  </Text>
        <Text color="green" bold>Player: {score.left}</Text>
        <Text>  │  </Text>
        <Text color="red" bold>CPU: {score.right}</Text>
        <Text>  │  </Text>
        <Text color="gray">First to {WIN_SCORE} wins!</Text>
      </Box>

      {/* Game Field */}
      <Box borderStyle="double" borderColor="white" width={WIDTH + 2} height={HEIGHT + 2} flexDirection="column">
        {renderField()}
      </Box>

      {/* Overlays */}
      {gameState === 'start' && (
        <Box position="absolute" marginTop={12}>
          <Box borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1} flexDirection="column" alignItems="center">
            <Text bold color="yellow">🎮 PRESS SPACE OR ENTER TO START 🎮</Text>
            <Text color="gray" dimColor>First to {WIN_SCORE} points wins!</Text>
          </Box>
        </Box>
      )}

      {gameState === 'paused' && (
        <Box position="absolute" marginTop={12}>
          <Box borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1}>
            <Text bold color="yellow">⏸️  PAUSED - Press P to resume</Text>
          </Box>
        </Box>
      )}

      {gameState === 'gameover' && (
        <Box position="absolute" marginTop={12}>
          <Box borderStyle="round" borderColor={winner === 'player' ? 'green' : 'red'} paddingX={2} paddingY={1} flexDirection="column" alignItems="center">
            <Text bold color={winner === 'player' ? 'green' : 'red'}>
              {winner === 'player' ? '🎉 YOU WIN! 🎉' : '💀 GAME OVER 💀'}
            </Text>
            <Text color="gray">Press SPACE or ENTER to play again</Text>
          </Box>
        </Box>
      )}

      {/* Controls */}
      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text color="gray">
          ↑/↓ or W/S to move • P to pause • Q to quit
        </Text>
        {onExit && (
          <Text color="gray" dimColor>
            Press Q to return to main menu
          </Text>
        )}
      </Box>
    </Box>
  );
}
