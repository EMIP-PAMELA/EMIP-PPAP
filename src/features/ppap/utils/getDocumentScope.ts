/**
 * V3.3A.3: Document Scope Retrieval
 * 
 * Retrieves the document scope configuration from PPAP_CREATED event.
 * Document scope is defined during PPAP creation and persisted in event_data.
 */

import { getEventsByPPAPId } from '@/src/features/events/mutations';
import { DocumentScopeEntry } from '../config/documentRegistry';

export async function getDocumentScope(ppapId: string): Promise<DocumentScopeEntry[]> {
  try {
    const events = await getEventsByPPAPId(ppapId);
    
    // Find PPAP_CREATED event
    const createdEvent = events.find(e => e.event_type === 'PPAP_CREATED');
    
    if (!createdEvent) {
      console.warn('No PPAP_CREATED event found for', ppapId);
      return [];
    }

    // Extract document_scope from event_data
    const eventData = createdEvent.event_data as any;
    const documentScope = eventData?.document_scope;

    if (!documentScope || !Array.isArray(documentScope)) {
      console.warn('No document_scope in PPAP_CREATED event for', ppapId);
      return [];
    }

    console.log('📋 Document scope retrieved:', {
      ppapId,
      documentCount: documentScope.length,
      requiredCount: documentScope.filter((d: DocumentScopeEntry) => d.required).length,
    });

    return documentScope as DocumentScopeEntry[];
  } catch (error) {
    console.error('Failed to retrieve document scope:', error);
    return [];
  }
}
