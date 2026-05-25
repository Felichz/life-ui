import React, { useState } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { useSystemCore } from '../hooks/useSystemCore';
import type { UUID } from '../../types';

export interface InterruptionModalProps {
    activityId: UUID | null;
    onClose: () => void;
}

export const InterruptionModal: React.FC<InterruptionModalProps> = ({ activityId, onClose }) => {
    const { state, interruptActivity, createInterruptionCause } = useSystemCore();
    const [isAvoidable, setIsAvoidable] = useState<boolean>(true);
    const [selectedCauseId, setSelectedCauseId] = useState<UUID | 'new' | ''>('');
    const [newCauseDescription, setNewCauseDescription] = useState('');
    const [error, setError] = useState<string | null>(null);

    if (!activityId) return null;

    const activity = state.currentDay?.activityInstances.find(a => a.id === activityId);
    if (!activity) return null;

    const template = state.global.activityTemplates.find(t => t.id === activity.templateId);
    const title = template?.title || 'Unknown Activity';

    const handleInterrupt = () => {
        try {
            let causeIdToUse: UUID | undefined = undefined;

            if (isAvoidable) {
                if (selectedCauseId === 'new') {
                    if (!newCauseDescription.trim()) {
                        setError("Please describe the new interruption cause.");
                        return;
                    }
                    const newCause = createInterruptionCause(newCauseDescription.trim());
                    causeIdToUse = newCause.id;
                } else if (selectedCauseId) {
                    causeIdToUse = selectedCauseId as UUID;
                } else {
                    setError("Please select a cause for the avoidable interruption.");
                    return;
                }
            }

            interruptActivity(activityId, isAvoidable, causeIdToUse);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to interrupt activity');
        }
    };

    const causes = state.global.interruptionCauses || [];

    return (
        <Modal
            isOpen={!!activityId}
            onClose={onClose}
            maxWidth="sm"
            title={`Interrupting: ${title}`}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    You are stopping this activity before it's completed. Was this interruption avoidable?
                </p>

                {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem', background: 'rgba(239,68,68,0.1)', padding: '0.5rem', borderRadius: '4px' }}>{error}</div>}

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                        <input
                            type="radio"
                            checked={isAvoidable}
                            onChange={() => setIsAvoidable(true)}
                            style={{ accentColor: 'var(--accent-primary)' }}
                        />
                        Yes, it was avoidable
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                        <input
                            type="radio"
                            checked={!isAvoidable}
                            onChange={() => setIsAvoidable(false)}
                            style={{ accentColor: 'var(--accent-primary)' }}
                        />
                        No, it was unavoidable
                    </label>
                </div>

                {isAvoidable && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.1)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>What caused this interruption?</label>
                            <select
                                value={selectedCauseId}
                                onChange={(e) => setSelectedCauseId(e.target.value as UUID | 'new')}
                                style={{
                                    padding: '0.75rem 1rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--glass-border)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'inherit',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="" disabled>Select a reason...</option>
                                {causes.map(cause => (
                                    <option key={cause.id} value={cause.id}>{cause.description}</option>
                                ))}
                                <option value="new">+ Create new reason</option>
                            </select>
                        </div>

                        {selectedCauseId === 'new' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <label style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>New Cause Description</label>
                                <input
                                    type="text"
                                    value={newCauseDescription}
                                    onChange={(e) => setNewCauseDescription(e.target.value)}
                                    placeholder="e.g., Checking Social Media, Phone Call"
                                    style={{
                                        padding: '0.75rem 1rem',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--glass-border)',
                                        background: 'var(--bg-primary)',
                                        color: 'var(--text-primary)',
                                        fontFamily: 'inherit'
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="danger" onClick={handleInterrupt}>
                        Stop Activity
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
