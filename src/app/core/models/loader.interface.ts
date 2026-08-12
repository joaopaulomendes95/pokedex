export type LoaderType = 'bar' | 'spinner';

export interface LoaderData {
  title?: string;
  message?: string;
  backBlur?: boolean;
  type: LoaderType;
}
