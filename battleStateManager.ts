// stateManager.ts updates for Battle Royale support
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BattleRoyaleState } from './services/jobs/battleRoyal.js';

// ES Module equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE_PATH = path.join(__dirname, 'state.json');
const BATTLE_ROYALE_STATE_FILE_PATH = path.join(__dirname, 'battleRoyaleState.json');

interface State {
    iteration: number;
    createdTokenAddress: string | null;
    currentPoolId: string | null;
    currentPositionId: string | null;
    liquidityWithdrawn: boolean;
}

// Default states
const DEFAULT_STATE: State = {
    iteration: 0,
    createdTokenAddress: null,
    currentPoolId: null,
    currentPositionId: null,
    liquidityWithdrawn: true,
};

const DEFAULT_BATTLE_ROYALE_STATE: BattleRoyaleState = {
    isActive: false,
    tournamentId: '',
    tokenMint: null,
    poolId: null,
    positionId: null,
    startTime: null,
    endTime: null,
    players: [],
    prizePool: 0,
    winners: [],
    liquidityWithdrawn: false
};

// Read functions
export async function readState(): Promise<State> {
    try {
        if (!fs.existsSync(STATE_FILE_PATH)) {
            await writeState(DEFAULT_STATE);
            return { ...DEFAULT_STATE };
        }

        const rawData = fs.readFileSync(STATE_FILE_PATH, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error('Error reading state:', error);
        return { ...DEFAULT_STATE };
    }
}

export async function readBattleRoyaleState(): Promise<BattleRoyaleState> {
    try {
        if (!fs.existsSync(BATTLE_ROYALE_STATE_FILE_PATH)) {
            await writeBattleRoyaleState(DEFAULT_BATTLE_ROYALE_STATE);
            return { ...DEFAULT_BATTLE_ROYALE_STATE };
        }

        const rawData = fs.readFileSync(BATTLE_ROYALE_STATE_FILE_PATH, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error('Error reading Battle Royale state:', error);
        return { ...DEFAULT_BATTLE_ROYALE_STATE };
    }
}

// Write functions
export async function writeState(state: State): Promise<void> {
    try {
        fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('Error writing state:', error);
        throw error;
    }
}

export async function writeBattleRoyaleState(state: BattleRoyaleState): Promise<void> {
    try {
        fs.writeFileSync(BATTLE_ROYALE_STATE_FILE_PATH, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('Error writing Battle Royale state:', error);
        throw error;
    }
}