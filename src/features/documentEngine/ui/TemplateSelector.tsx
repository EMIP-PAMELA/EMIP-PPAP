'use client';

import { useEffect, useState } from 'react';
import { listTemplates } from '../templates/registry';
import { TemplateDefinition, TemplateId } from '../templates/types';

interface TemplateSelectorProps {
  onTemplateSelected: (templateId: TemplateId) => void;
  disabled?: boolean;
}

export function TemplateSelector({ onTemplateSelected, disabled }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<TemplateId | null>(null);

  useEffect(() => {
    const availableTemplates = listTemplates();
    setTemplates(availableTemplates);
  }, []);

  const handleSelect = (templateId: TemplateId) => {
    setSelectedId(templateId);
    onTemplateSelected(templateId);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Select Document Template</h3>
      
      {templates.length === 0 && (
        <p className="text-gray-600">No templates available</p>
      )}

      <div className="grid gap-4">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => handleSelect(template.id)}
            disabled={disabled}
            className={`
              p-4 border-2 rounded-lg text-left transition-colors
              ${selectedId === template.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-blue-300'
              }
              ${disabled 
                ? 'opacity-50 cursor-not-allowed' 
                : 'cursor-pointer'
              }
            `}
          >
            <h4 className="font-semibold text-lg">{template.name}</h4>
            <p className="text-gray-600 text-sm mt-1">{template.description}</p>
            <p className="text-gray-500 text-xs mt-2">
              {template.requiredInputs.length} required fields
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
