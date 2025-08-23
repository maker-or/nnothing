/**
 * Utility functions for handling web search operations
 */

// Define interfaces for the enhanced search response
interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface SearchResponse {
  results: string;
  metadata: {
    sources: SearchResult[];
    query: string;
    timestamp: string;
  };
}

/**
 * Performs a web search using the search API
 * @param query The search query string
 * @returns The search results with metadata
 * @throws Error if query is empty or search fails
 */
export async function performWebSearch(query: string): Promise<SearchResponse> {
  // Validate query before making request
  if (!query || query.trim() === '') {
    throw new Error('No query to search');
  }
  
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: query }]
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Search request failed');
  }

  return await response.json();
}

/**
 * Safe wrapper for web search that handles errors
 * @param query The search query string
 * @param onError Optional callback for error handling
 * @returns The search results or null if there was an error
 */
export async function safeWebSearch(
  query: string, 
  onError?: (error: Error) => void
): Promise<SearchResponse | null> {
  try {
    // Ensure query isn't empty
    if (!query || query.trim() === '') {
      throw new Error('No query to search');
    }
    return await performWebSearch(query);
  } catch (error) {
    if (onError && error instanceof Error) {
      onError(error);
    } else {
      console.error('Search error:', error);
    }
    return null;
  }
}

/**
 * Formats search results with citation links for display
 * @param searchResponse The search response from the API
 * @returns HTML formatted text with citation links
 */
export function formatSearchResultsWithCitations(searchResponse: SearchResponse): string {
  if (!searchResponse || !searchResponse.results) {
    return '';
  }
  
  let formattedText = searchResponse.results;
  
  // Replace citation references [1], [2], etc. with linked references
  if (searchResponse.metadata?.sources) {
    searchResponse.metadata.sources.forEach((source, index) => {
      const citationMark = `[${index + 1}]`;
      const citationLink = `<a href="${source.url}" target="_blank" rel="noopener noreferrer" class="citation-link">${citationMark}</a>`;
      
      // Replace all occurrences of the citation mark
      const regex = new RegExp(`\\[${index + 1}\\]`, 'g');
      formattedText = formattedText.replace(regex, citationLink);
    });
  }
  
  return formattedText;
}

/**
 * Gets a list of formatted sources for display
 * @param searchResponse The search response from the API
 * @returns Array of formatted source strings
 */
export function getFormattedSources(searchResponse: SearchResponse): string[] {
  if (!searchResponse?.metadata?.sources) {
    return [];
  }
  
  return searchResponse.metadata.sources.map((source, index) => {
    return `[${index + 1}] ${source.title} - ${source.url}`;
  });
}
