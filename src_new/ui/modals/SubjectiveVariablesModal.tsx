import React, { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { useSystemCore } from '../hooks/useSystemCore';
import type { UUID } from '../../types';

export interface SubjectiveVariablesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SubjectiveVariablesModal: React.FC<SubjectiveVariablesModalProps> = ({ isOpen, onClose }) => {
    const { state, createSnapshot, getLatestValues, canUpdateVariables } = useSystemCore();
    const [values, setValues] = useState<Record<UUID, number>>({});
    const [error, setError] = useState<string | null>(null);

    // Initialize values when modal opens
    useEffect(() => {
        if (isOpen) {
            const latest = getLatestValues();
            const initialValues: Record<UUID, number> = {};

            // For each defined variable, set to its latest value or default to 5
            state.global.subjectiveVariables.forEach(v => {
                initialValues[v.id] = latest[v.id] !== undefined ? latest[v.id] : 5;
            });

            setValues(initialValues);
            setError(null);
        }
    }, [isOpen, state.global.subjectiveVariables]);

    const handleSliderChange = (id: UUID, value: number) => {
        setValues(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const handleSave = () => {
        try {
            if (!canUpdateVariables()) {
                setError("You must wait at least 30 minutes between subjective state updates.");
                return;
            }

            const valuesArray = Object.entries(values).map(([variableId, currentValue]) => ({
                variableId,
                currentValue
            }));

            createSnapshot(valuesArray);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save snapshot.');
        }
    };

    const canSubmit = state.global.subjectiveVariables.length > 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="sm"
            title="Log Subjective State"
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    How are you feeling right now? Rate from 1 (Lowest) to 10 (Highest).
                </p>

                {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem', background: 'rgba(239,68,68,0.1)', padding: '0.5rem', borderRadius: '4px' }}>{error}</div>}

                {state.global.subjectiveVariables.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No subjective variables defined yet. Go to Settings to create them (e.g., Energy, Focus, Mood).
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {state.global.subjectiveVariables.map(variable => (
                            <div key={variable.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                        {variable.name}
                                    </label>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                        {values[variable.id] || 5}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="1"
                                    value={values[variable.id] || 5}
                                    onChange={(e) => handleSliderChange(variable.id, Number(e.target.value))}
                                    style={{
                                        width: '100%',
                                        accentColor: 'var(--accent-primary)',
                                        cursor: 'pointer'
                                    }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <span>Low</span>
                                    <span>High</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        disabled={!canSubmit}
                    >
                        Save Snapshot
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
