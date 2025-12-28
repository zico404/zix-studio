
export interface ImageState {
  originalUrl: string | null;
  currentUrl: string | null;
  history: string[];
  currentIndex: number;
}

export interface Message {
  role: 'user' | 'model';
  content: string;
  imageUrl?: string;
  isError?: boolean;
}

export interface Session {
  id: string;
  name: string;
  timestamp: number;
  imageState: ImageState;
  messages: Message[];
  previewUrl: string | null;
}

export enum LoadingState {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  EDITING = 'EDITING'
}
