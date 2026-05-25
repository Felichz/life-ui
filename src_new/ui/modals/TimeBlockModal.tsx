import React, { useState } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { useSystemCore } from '../hooks/useSystemCore';
import { TimeBlockForm, TimeBlockFormData } from '../components/Forms/TimeBlockForm';
import type { TimeBlock, UUID } from '../../types';

export interface TimeBlockModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Convert minutes (0-1439) to "HH:MM" for display
const minutesToTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

export const TimeBlockModal: React.FC<TimeBlockModalProps> = ({ isOpen, onClose }) => {
    const { state, createTimeBlock, updateTimeBlock, deleteTimeBlock, getTimeBlocks } = useSystemCore();
    const [isCreating, setIsCreating] = useState(false);
    const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null);

    // Get time blocks directly from the API method
    const blocks = getTimeBlocks();

    const handleSaveBlock = (data: TimeBlockFormData) => {
        try {
            if (editingBlock) {
                updateTimeBlock(editingBlock.id, { ...data });
            } else {
                createTimeBlock(data.name, data.startMinute, data.endMinute);
            }
            setIsCreating(false);
            setEditingBlock(null);
        } catch (error: any) {
            alert(error.message); // Basic error handling, could enhance with toast
        }
    };

    const handleDelete = (id: UUID) => {
        if (confirm("Are you sure you want to delete this block? Any activities within it will be moved to the default Todo block.")) {
            try {
                deleteTimeBlock(id);
            } catch (error: any) {
                alert(error.message);
            }
        }
    };

    const resetState = () => {
        setIsCreating(false);
        setEditingBlock(null);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    if (isCreating || editingBlock) {
        return (
            <Modal isOpen={isOpen} onClose={handleClose} maxWidth="sm" title={editingBlock ? "Edit Time Block" : "Create Time Block"}>
                <TimeBlockForm
                    initialData={editingBlock || undefined}
                    onSave={handleSaveBlock}
                    onCancel={() => { setIsCreating(false); setEditingBlock(null); }}
                />
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            maxWidth="lg"
            title="Manage Time Blocks"
            footer={<Button variant="ghost" onClick={handleClose} fullWidth>Close</Button>}
        >
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', justifyContent: 'flex-end' }}>
                <Button variant="primary" onClick={() => setIsCreating(true)}>+ Create Block</Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {blocks.map(block => (
                    <div
                        key={block.id}
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem'
                        }}
                    >
                        <div style={{ flex: 1 }}>
                            <h4 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 500 }}>
                                {block.name}
                                {block.isDefault && (
                                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.1rem 0.4rem', background: 'var(--accent-primary)', color: 'white', borderRadius: '4px' }}>
                                        Default
                                    </span>
                                )}
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {block.isDefault ? 'All Day' : `${minutesToTime(block.startMinute)} - ${minutesToTime(block.endMinute)}`}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <Button size="sm" variant="secondary" onClick={() => setEditingBlock(block)}>Edit</Button>
                            {!block.isDefault && (
                                <Button size="sm" variant="danger" onClick={() => handleDelete(block.id)}>Delete</Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
};
