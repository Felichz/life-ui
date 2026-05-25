import React, { useState } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { useSystemCore } from '../hooks/useSystemCore';
import type { EventTemplate, UUID } from '../../types';

export interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose }) => {
    const { state, createEventTemplate, createEventInstance, isDayActive } = useSystemCore();
    const [searchTerm, setSearchTerm] = useState('');
    const [newTemplateName, setNewTemplateName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const templates = state.global.eventTemplates.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCreateTemplate = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTemplateName.trim()) {
            createEventTemplate(newTemplateName.trim());
            setNewTemplateName('');
            setIsCreating(false);
        }
    };

    const handleLogEvent = (templateId: UUID) => {
        if (!isDayActive()) {
            alert("Debe comenzar el día antes de registrar eventos.");
            return;
        }
        createEventInstance(templateId);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="sm"
            title="Log an Event"
            footer={<Button variant="ghost" onClick={onClose} fullWidth>Close</Button>}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <input
                        type="text"
                        placeholder="Search events..."
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
                    <Button variant="secondary" onClick={() => setIsCreating(!isCreating)}>
                        {isCreating ? 'Cancel' : 'New'}
                    </Button>
                </div>

                {isCreating && (
                    <form onSubmit={handleCreateTemplate} style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                        <input
                            type="text"
                            placeholder="New event name..."
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            autoFocus
                            style={{
                                flex: 1,
                                padding: '0.5rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--glass-border)',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                            }}
                        />
                        <Button type="submit" variant="primary" size="sm">Create</Button>
                    </form>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }} className="scrollbar-hide">
                    {templates.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '1rem 0' }}>
                            No events found. Create one above!
                        </p>
                    ) : (
                        templates.map(template => (
                            <div
                                key={template.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.75rem 1rem',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--glass-border)'
                                }}
                            >
                                <span style={{ fontWeight: 500 }}>{template.name}</span>
                                <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => handleLogEvent(template.id)}
                                    disabled={!isDayActive()}
                                >
                                    Log
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Modal>
    );
};
