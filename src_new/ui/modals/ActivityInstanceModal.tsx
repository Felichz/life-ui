import React from 'react';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { useSystemCore } from '../hooks/useSystemCore';
import { ActivityInstanceForm } from '../components/Forms/ActivityInstanceForm';
import type { ActivityInstance, UUID } from '../../types';

export interface ActivityInstanceModalProps {
    activityId: UUID | null;
    onClose: () => void;
}

export const ActivityInstanceModal: React.FC<ActivityInstanceModalProps> = ({ activityId, onClose }) => {
    const { state, updateActivityInstance, deleteActivityInstance } = useSystemCore();

    if (!activityId || !state.currentDay) {
        return null;
    }

    const activity = state.currentDay.activityInstances.find(a => a.id === activityId);
    if (!activity) {
        return null;
    }

    const template = state.global.activityTemplates.find(t => t.id === activity.templateId);
    const title = template?.title || 'Activity Configuration';

    const handleSave = (data: Partial<ActivityInstance>) => {
        try {
            updateActivityInstance(activity.id, data);
            onClose();
        } catch (error: any) {
            alert(error.message);
        }
    };

    const handleDelete = () => {
        if (confirm("Are you sure you want to delete this activity from your day?")) {
            try {
                deleteActivityInstance(activity.id);
                onClose();
            } catch (error: any) {
                alert(error.message);
            }
        }
    };

    return (
        <Modal
            isOpen={!!activityId}
            onClose={onClose}
            maxWidth="sm"
            title={title}
            footer={
                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Button variant="danger" size="sm" onClick={handleDelete}>Delete Instance</Button>
                </div>
            }
        >
            <ActivityInstanceForm
                instance={activity}
                onSave={handleSave}
                onCancel={onClose}
            />
        </Modal>
    );
};
