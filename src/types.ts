export interface StockData {
  symbol: string;
  price: number;
  timestamp: number;
  change?: number;
  changePercent?: number;
}

export interface MassiveMessage {
  action: string;
  params?: any;
  data?: any;
}

export interface WebSocketMessage {
  event: string;
  data: any;
}
