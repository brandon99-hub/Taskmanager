import { queryClient } from './queryClient';

// Batch multiple API calls into a single request
export class QueryBatcher {
  private static instance: QueryBatcher;
  private batchQueue: Array<{
    key: string;
    url: string;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  static getInstance(): QueryBatcher {
    if (!QueryBatcher.instance) {
      QueryBatcher.instance = new QueryBatcher();
    }
    return QueryBatcher.instance;
  }

  // Add a query to the batch
  async batchQuery(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const key = url;
      
      // Check if we already have this data cached
      const cachedData = queryClient.getQueryData([key]);
      if (cachedData) {
        resolve(cachedData);
        return;
      }

      // Add to batch queue
      this.batchQueue.push({ key, url, resolve, reject });

      // Set timeout to process batch
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.processBatch();
        }, 50); // 50ms batching window
      }
    });
  }

  // Process the batch of queries
  private async processBatch() {
    if (this.batchQueue.length === 0) return;

    const currentBatch = [...this.batchQueue];
    this.batchQueue = [];
    this.batchTimeout = null;

    try {
      // Create a batch request
      const batchRequest = {
        queries: currentBatch.map(item => ({ url: item.url, key: item.key }))
      };

      // Send batch request to server
      const response = await fetch('/api/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchRequest),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Batch request failed: ${response.status}`);
      }

      const batchResults = await response.json();

      // Resolve each query with its result
      currentBatch.forEach((item, index) => {
        const result = batchResults.results[index];
        if (result.error) {
          item.reject(new Error(result.error));
        } else {
          // Cache the result
          queryClient.setQueryData([item.key], result.data);
          item.resolve(result.data);
        }
      });

    } catch (error) {
      // If batch fails, fall back to individual requests
      console.warn('Batch request failed, falling back to individual requests:', error);
      
      for (const item of currentBatch) {
        try {
          const response = await fetch(item.url, { credentials: 'include' });
          if (!response.ok) throw new Error(`Failed to fetch ${item.url}`);
          const data = await response.json();
          
          // Cache the result
          queryClient.setQueryData([item.key], data);
          item.resolve(data);
        } catch (err) {
          item.reject(err);
        }
      }
    }
  }
}

// Convenience function for batching queries
export async function batchQuery(url: string): Promise<any> {
  return QueryBatcher.getInstance().batchQuery(url);
}

// Hook for batched queries
export function useBatchedQuery<T>(queryKey: string[], url: string, options?: any) {
  return queryClient.useQuery({
    queryKey,
    queryFn: () => batchQuery(url),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options
  });
}
