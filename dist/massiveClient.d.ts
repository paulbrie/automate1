import { EventEmitter } from 'events';
export declare class MassiveClient extends EventEmitter {
    private ws;
    private readonly apiKey;
    private readonly symbols;
    private reconnectTimeout;
    private isConnecting;
    private simulationInterval;
    constructor(apiKey: string);
    connect(): Promise<void>;
    private setupEventHandlers;
    private subscribeToStocks;
    private handleMessage;
    private scheduleReconnect;
    disconnect(): void;
    startSimulation(): void;
}
