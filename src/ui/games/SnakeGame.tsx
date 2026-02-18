import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';

const WIDTH = 40;
const HEIGHT = 20;
const TICK_RATE = 100; // ms

interface SnakeGameProps {
  onExit?: () => void;
}

interface Point {
  x: number;
  y: number;
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'start' | 'playing' | 'paused' | 'gameover';

export default function SnakeGame({ onExit }: SnakeGameProps) {
  const { exit } = useApp();
  const [gameState, setGameState] = useState<GameState>('start');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Game state refs
  const snakeRef = useRef<Point[]>([{ x: 10, y: 10 }]);
  const foodRef = useRef<Point>({ x: 15, y: 10 });
  const directionRef = useRef<Direction>('RIGHT');
  const nextDirectionRef = useRef<Direction>('RIGHT');
  
  // Render state
  const [renderSnake, setRenderSnake] = useState<Point[]>(snakeRef.current);
  const [renderFood, setRenderFood] = useState<Point>(foodRef.current);

  const handleExit = useCallback(() => {
    if (onExit) {
      onExit();
    } else {
      exit();
    }
  }, [onExit, exit]);

  const generateFood = useCallback((snake: Point[]): Point => {
    let newFood: Point;
    let isOnSnake: boolean;
    do {
      newFood = {
        x: Math.floor(Math.random() * WIDTH),
        y: Math.floor(Math.random() * HEIGHT),
      };
      // eslint-disable-next-line no-loop-func
      isOnSnake = snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
    } while (isOnSnake);
    return newFood;
  }, []);

  const resetGame = useCallback(() => {
    snakeRef.current = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    directionRef.current = 'RIGHT';
    nextDirectionRef.current = 'RIGHT';
    setScore(0);
    foodRef.current = generateFood(snakeRef.current);
    
    setRenderSnake(snakeRef.current);
    setRenderFood(foodRef.current);
  }, [generateFood]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = setInterval(() => {
      // Update direction
      directionRef.current = nextDirectionRef.current;
      const head = { ...snakeRef.current[0] };

      switch (directionRef.current) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
      }

      // Check collision with walls
      if (head.x < 0 || head.x >= WIDTH || head.y < 0 || head.y >= HEIGHT) {
        setGameState('gameover');
        if (score > highScore) setHighScore(score);
        return;
      }

      // Check collision with self
      if (snakeRef.current.some(segment => segment.x === head.x && segment.y === head.y)) {
        setGameState('gameover');
        if (score > highScore) setHighScore(score);
        return;
      }

      const newSnake = [head, ...snakeRef.current];
      
      // Check collision with food
      if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
        setScore(s => s + 1);
        foodRef.current = generateFood(newSnake);
        setRenderFood(foodRef.current);
        // Don't pop tail, so snake grows
      } else {
        newSnake.pop();
      }

      snakeRef.current = newSnake;
      setRenderSnake(newSnake);

    }, TICK_RATE);

    return () => clearInterval(timer);
  }, [gameState, generateFood, score, highScore]);

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

    // Movement
    if (gameState === 'playing') {
      if ((key.upArrow || input === 'w' || input === 'W') && directionRef.current !== 'DOWN') {
        nextDirectionRef.current = 'UP';
      }
      if ((key.downArrow || input === 's' || input === 'S') && directionRef.current !== 'UP') {
        nextDirectionRef.current = 'DOWN';
      }
      if ((key.leftArrow || input === 'a' || input === 'A') && directionRef.current !== 'RIGHT') {
        nextDirectionRef.current = 'LEFT';
      }
      if ((key.rightArrow || input === 'd' || input === 'D') && directionRef.current !== 'LEFT') {
        nextDirectionRef.current = 'RIGHT';
      }
    }
  });

  const renderField = () => {
    const rows: React.ReactNode[] = [];
    
    // Create a map for quick lookup
    const snakeMap = new Set(renderSnake.map(p => `${p.x},${p.y}`));

    for (let y = 0; y < HEIGHT; y++) {
      let row = '';
      for (let x = 0; x < WIDTH; x++) {
        if (renderFood.x === x && renderFood.y === y) {
          row += '🍎'; // Food
        } else if (snakeMap.has(`${x},${y}`)) {
          // Head vs Body visualization could be added here
          row += '🟩'; // Snake body
        } else {
          row += ' .'; // Empty space (using dot for grid visibility)
        }
      }
      rows.push(<Text key={y}>{row}</Text>);
    }
    return rows;
  };

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
      {/* Title and Score */}
      <Box borderStyle="round" borderColor="green" paddingX={2} marginBottom={1}>
        <Text bold color="green">🐍 SNAKE  </Text>
        <Text color="white" bold>Score: {score}</Text>
        <Text>  │  </Text>
        <Text color="yellow" bold>High Score: {Math.max(score, highScore)}</Text>
      </Box>

      {/* Game Field */}
      <Box borderStyle="double" borderColor="white" flexDirection="column">
        {renderField()}
      </Box>

      {/* Overlays */}
      {gameState === 'start' && (
        <Box position="absolute" marginTop={10}>
          <Box borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1} flexDirection="column" alignItems="center">
            <Text bold color="yellow">🎮 PRESS SPACE OR ENTER TO START 🎮</Text>
            <Text color="gray" dimColor>Use Arrow Keys or WASD to move</Text>
          </Box>
        </Box>
      )}

      {gameState === 'paused' && (
        <Box position="absolute" marginTop={10}>
          <Box borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1}>
            <Text bold color="yellow">⏸️  PAUSED - Press P to resume</Text>
          </Box>
        </Box>
      )}

      {gameState === 'gameover' && (
        <Box position="absolute" marginTop={10}>
          <Box borderStyle="round" borderColor="red" paddingX={2} paddingY={1} flexDirection="column" alignItems="center">
            <Text bold color="red">💀 GAME OVER 💀</Text>
            <Text color="white">Final Score: {score}</Text>
            <Text color="gray">Press SPACE to play again</Text>
          </Box>
        </Box>
      )}

      {/* Controls */}
      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text color="gray">
          ↑/↓/←/→ or WASD to move • P to pause • Q to quit
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
