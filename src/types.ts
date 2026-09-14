export type PdfDoc = {
  id: string;
  name: string;
  uri: string;
  size: number;
  addedAt: number;
  openedAt: number;
  lastPage: number;
  totalPages: number;
  bookmarks: number[];
  thumbUri?: string;
  /** Precisou de senha para abrir; miniaturas não são persistidas. */
  protected?: boolean;
};

export type SortMode = 'recent' | 'name' | 'added';

export type SearchHit = {
  page: number;
  snippet: string;
};
