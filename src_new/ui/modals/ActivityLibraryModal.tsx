import React, { useState } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { useSystemCore } from '../hooks/useSystemCore';
import { ActivityTemplateForm, ActivityTemplateFormData } from '../components/Forms/ActivityTemplateForm';
import type { ActivityTemplate, UUID } from '../../types';

interface ActivityLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ActivityLibraryModal: React.FC<ActivityLibraryModalProps> = ({ isOpen, onClose }) => {
    const { state, createActivityTemplate, updateActivityTemplate, createActivityInstance, isDayActive, getTimeBlocks } = useSystemCore();
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ActivityTemplate | null>(null);

    const templates = state.global.activityTemplates.filter(t =>
        t.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleInstantiate = (templateId: UUID) => {
        if (isDayActive()) {
            const blocks = getTimeBlocks();
            if (blocks.length > 0) {
                createActivityInstance(templateId, blocks[0].id);
            }
        }
    };

    const handleSaveTemplate = (data: ActivityTemplateFormData) => {
        if (editingTemplate) {
            updateActivityTemplate(editingTemplate.id, { ...data, isSystemActivity: false });
        } else {
            createActivityTemplate({ ...data, isSystemActivity: false });
        }
        setIsCreating(false);
        setEditingTemplate(null);
    };

    const resetState = () => {
        setIsCreating(false);
        setEditingTemplate(null);
        setSearchTerm('');
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    if (isCreating || editingTemplate) {
        return (
            <Modal isOpen={isOpen} onClose={handleClose} maxWidth="sm" title={editingTemplate ? "Edit Template" : "Create New Template"}>
                <ActivityTemplateForm
                    initialData={editingTemplate || undefined}
                    onSave={handleSaveTemplate}
                    onCancel={() => { setIsCreating(false); setEditingTemplate(null); }}
                />
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            maxWidth="lg"
            title="Activity Library"
            footer={<Button variant="ghost" onClick={handleClose} fullWidth>Close</Button>}
        >
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <input
                    type="text"
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--glass-border)',
                        background: 'rgba(0,0,0,0.2)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontFamily: 'inherit'
                    }}
                />
                <Button variant="primary" onClick={() => setIsCreating(true)}>Create New</Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {templates.map(template => (
                    <div
                        key={template.id}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem'
                        }}
                    >
                        <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 500 }}>{template.title}</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {template.type}
                        </p>
                        <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                            <Button size="sm" variant="secondary" style={{ flex: 1 }} onClick={() => setEditingTemplate(template)}>Edit</Button>
                            {isDayActive() && (
                                <Button size="sm" variant="primary" style={{ flex: 1 }} onClick={() => handleInstantiate(template.id)}>
                                    Add to Day
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
                {templates.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No templates found. Create one to get started!
                    </div>
                )}
            </div>
        </Modal>
    );
};
