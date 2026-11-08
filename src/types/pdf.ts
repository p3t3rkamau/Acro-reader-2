/** Where a document comes from. */
export type PDFSource =
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: string };

/** One bookmark from the PDF's real outline tree. */
export interface OutlineNode {
  id: string;
  title: string;
  /** Named destination (string) or explicit destination array. Resolved by PDFLinkService. */
  dest: unknown;
  /** External URL, when the bookmark is a URI action instead of a GoTo. */
  url: string | null;
  bold: boolean;
  italic: boolean;
  children: OutlineNode[];
}

export type LoadErrorKind = 'invalid' | 'missing' | 'network' | 'password' | 'unknown';

export interface LoadError {
  kind: LoadErrorKind;
  title: string;
  detail: string;
}

/** Whether the server supports HTTP byte-range requests (URL sources only). */
export type RangeSupport = 'yes' | 'no' | 'unknown' | 'n/a';

export interface ViewerState {
  status: 'loading' | 'ready' | 'error';
  /** 0..1, or null when the total size is unknown. */
  loadProgress: number | null;
  numPages: number;
  currentPage: number;
  /** Numeric scale; 1 = 100% (96 dpi CSS pixels, same as Acrobat's "Actual size"). */
  scale: number;
  /** Preset name ("page-width", "page-fit") or a numeric string. */
  scaleValue: string;
  title: string | null;
  canGoBack: boolean;
  /** null while loading, [] when the document has no bookmarks. */
  outline: OutlineNode[] | null;
  error: LoadError | null;
  /** 1-based numbers of pages whose rendering failed. */
  renderErrors: number[];
  rangeSupport: RangeSupport;
  fileSize: number | null;
}

export const initialViewerState: ViewerState = {
  status: 'loading',
  loadProgress: 0,
  numPages: 0,
  currentPage: 1,
  scale: 1,
  scaleValue: 'page-width',
  title: null,
  canGoBack: false,
  outline: null,
  error: null,
  renderErrors: [],
  rangeSupport: 'n/a',
  fileSize: null,
};

export type LayoutMode = 'phone' | 'tablet' | 'desktop';
