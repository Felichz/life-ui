import React, { useState } from 'react';
import { Button } from '../Button';
import type { ActivityTemplate, ActivityType, TimeboxingType } from '../../../types';

export interface ActivityTemplateFormData {
    title: string;
    description: string;
    type: ActivityType;
    clearObjectiveSettings?: { estimatedDurationMinutes: number };
    flexibleDurationSettings?: { minimumDurationMinutes: number; maximumDurationMinutes: number };
    timeboxingSettings?: { type: TimeboxingType; minimumDurationMinutes?: number; maximumDurationMinutes?: number };
}

interface Props {
    initialData?: ActivityTemplate;
    onSave: (data: ActivityTemplateFormData) => void;
    onCancel: () => void;
}

export const ActivityTemplateForm: React.FC<Props> = ({ initialData, onSave, onCancel }) => {
    const [formData, setFormData] = useState<ActivityTemplateFormData>({
        title: initialData?.title || '',
        description: initialData?.description || '',
        type: initialData?.type || 'clear-objective',
        clearObjectiveSettings: initialData?.clearObjectiveSettings || { estimatedDurationMinutes: 30 },
        flexibleDurationSettings: initialData?.flexibleDurationSettings || { minimumDurationMinutes: 15, maximumDurationMinutes: 60 },
        timeboxingSettings: initialData?.timeboxingSettings || { type: 'minimum-time', minimumDurationMinutes: 15 },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) return;

        // Clean up data before saving based on type
        const payload = {
            ...formData,
            clearObjectiveSettings: formData.type === 'clear-objective' ? formData.clearObjectiveSettings : undefined,
            flexibleDurationSettings: formData.type === 'flexible-duration' ? formData.flexibleDurationSettings : undefined,
            timeboxingSettings: formData.type === 'timeboxing' ? formData.timeboxingSettings : undefined,
        };
        onSave(payload);
    };

    const inputStyle = {
        width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)',
        color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
        marginBottom: '1rem'
    };

    const labelStyle = { display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
                <label style={labelStyle}>Title</label>
                <input
                    style={inputStyle}
                    required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Morning Workout"
                />
            </div>

            <div>
                <label style={labelStyle}>Description (optional)</label>
                <textarea
                    style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief details about this activity..."
                />
            </div>

            <div>
                <label style={labelStyle}>Activity Type</label>
                <select
                    style={inputStyle}
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as ActivityType })}
                >
                    <option value="clear-objective">Clear Objective (Estimated Time)</option>
                    <option value="flexible-duration">Flexible Duration (Min/Max Range)</option>
                    <option value="timeboxing">Timeboxing (Strict boundary)</option>
                </select>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                {formData.type === 'clear-objective' && (
                    <div>
                        <label style={labelStyle}>Estimated Duration (minutes)</label>
                        <input
                            type="number" style={inputStyle} min={1}
                            value={formData.clearObjectiveSettings?.estimatedDurationMinutes || 30}
                            onChange={e => setFormData({
                                ...formData,
                                clearObjectiveSettings: { estimatedDurationMinutes: parseInt(e.target.value) || 30 }
                            })}
                        />
                    </div>
                )}

                {formData.type === 'flexible-duration' && (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Min Minutes</label>
                            <input
                                type="number" style={inputStyle} min={1}
                                value={formData.flexibleDurationSettings?.minimumDurationMinutes || 15}
                                onChange={e => setFormData({
                                    ...formData,
                                    flexibleDurationSettings: { ...formData.flexibleDurationSettings!, minimumDurationMinutes: parseInt(e.target.value) || 15 }
                                })}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={labelStyle}>Max Minutes</label>
                            <input
                                type="number" style={inputStyle} min={1}
                                value={formData.flexibleDurationSettings?.maximumDurationMinutes || 60}
                                onChange={e => setFormData({
                                    ...formData,
                                    flexibleDurationSettings: { ...formData.flexibleDurationSettings!, maximumDurationMinutes: parseInt(e.target.value) || 60 }
                                })}
                            />
                        </div>
                    </div>
                )}

                {formData.type === 'timeboxing' && (
                    <>
                        <label style={labelStyle}>Timeboxing Policy</label>
                        <select
                            style={inputStyle}
                            value={formData.timeboxingSettings?.type || 'minimum-time'}
                            onChange={e => setFormData({
                                ...formData,
                                timeboxingSettings: { ...formData.timeboxingSettings!, type: e.target.value as TimeboxingType }
                            })}
                        >
                            <option value="minimum-time">Minimum Time Requirement</option>
                            <option value="maximum-time">Maximum Time Limit</option>
                            <option value="strict-range">Strict Min/Max Range</option>
                        </select>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {['minimum-time', 'strict-range'].includes(formData.timeboxingSettings?.type || '') && (
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Min Minutes</label>
                                    <input
                                        type="number" style={inputStyle} min={1}
                                        value={formData.timeboxingSettings?.minimumDurationMinutes || 15}
                                        onChange={e => setFormData({
                                            ...formData,
                                            timeboxingSettings: { ...formData.timeboxingSettings!, minimumDurationMinutes: parseInt(e.target.value) || 15 }
                                        })}
                                    />
                                </div>
                            )}
                            {['maximum-time', 'strict-range'].includes(formData.timeboxingSettings?.type || '') && (
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Max Minutes</label>
                                    <input
                                        type="number" style={inputStyle} min={1}
                                        value={formData.timeboxingSettings?.maximumDurationMinutes || 60}
                                        onChange={e => setFormData({
                                            ...formData,
                                            timeboxingSettings: { ...formData.timeboxingSettings!, maximumDurationMinutes: parseInt(e.target.value) || 60 }
                                        })}
                                    />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <Button type="button" variant="ghost" onClick={onCancel} style={{ flex: 1 }}>Cancel</Button>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>{initialData ? 'Save Changes' : 'Create Template'}</Button>
            </div>
        </form>
    );
};
