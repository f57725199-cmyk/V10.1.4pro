
import React, { useState, useEffect } from 'react';
import { User, RoutineSlot, Subject } from '../types';
import { getSubjectsList } from '../constants';
import { Clock, CheckCircle, Calendar, Plus, Edit2, AlertCircle, Shield, Flame, RotateCcw, Play, CheckSquare } from 'lucide-react';
import { saveUserToLive } from '../firebase';

interface Props {
    user: User;
    onUpdateUser: (user: User) => void;
}

export const RoutinePage: React.FC<Props> = ({ user, onUpdateUser }) => {
    const [slots, setSlots] = useState<RoutineSlot[]>([]);
    const [isSundayMode, setIsSundayMode] = useState(new Date().getDay() === 0);
    const [showAddSlot, setShowAddSlot] = useState(false);
    const [newSlotTime, setNewSlotTime] = useState('');
    const [newSlotSubject, setNewSlotSubject] = useState('');
    const [timerActive, setTimerActive] = useState<string | null>(null); // Slot ID
    const [timeLeft, setTimeLeft] = useState(0);

    // --- INITIALIZE ROUTINE (V22 LOGIC) ---
    useEffect(() => {
        generateDailyRoutine();
    }, [user.classLevel, user.studyRoutine]);

    const generateDailyRoutine = () => {
        const today = new Date();
        const dayIndex = today.getDay(); // 0 = Sun
        const todayStr = today.toISOString().split('T')[0];

        // 1. Check if Routine Exists for Today
        // Ideally we store 'currentDailySlots' in user.studyRoutine, but for simplicity we generate on fly if missing
        // or check localStorage for today's generated schedule.
        const storedKey = `nst_routine_${user.id}_${todayStr}`;
        const stored = localStorage.getItem(storedKey);

        if (stored) {
            setSlots(JSON.parse(stored));
            return;
        }

        // 2. Sunday Catch-Up Mode
        if (dayIndex === 0) {
            setIsSundayMode(true);
            const missed = user.studyRoutine?.missedSlots || [];
            if (missed.length > 0) {
                setSlots(missed.map(s => ({ ...s, activityType: 'CATCH_UP' })));
            } else {
                setSlots([]); // Free Day!
            }
            return;
        }

        // 3. Generate 6-Hour Standard Routine (Subject Rotation)
        const subjects = getSubjectsList(user.classLevel || '10', user.stream || null);
        const coreSubjects = subjects.filter(s => ['math','science','physics','chemistry','biology','accounts','business','history','polity'].includes(s.id));
        
        // Rotation Logic: 2 Core Subjects per day + 1 Language/Extra
        const rotationIdx = (dayIndex - 1) * 2; // Mon=0, Tue=2...
        const sub1 = coreSubjects[rotationIdx % coreSubjects.length] || subjects[0];
        const sub2 = coreSubjects[(rotationIdx + 1) % coreSubjects.length] || subjects[1];
        
        // 6 Slots Default
        const defaultSlots: RoutineSlot[] = [
            { id: `slot-1`, startTime: '06:00', durationMinutes: 60, subjectId: 'current_affairs', topic: 'Daily Current Affairs & Notes', activityType: 'LEARN', isCompleted: false },
            { id: `slot-2`, startTime: '16:00', durationMinutes: 60, subjectId: sub1.id, topic: 'Core Concept Study', activityType: 'LEARN', isCompleted: false },
            { id: `slot-3`, startTime: '17:15', durationMinutes: 60, subjectId: sub1.id, topic: 'Practice Questions (MCQ)', activityType: 'PRACTICE', isCompleted: false },
            { id: `slot-4`, startTime: '19:00', durationMinutes: 60, subjectId: sub2.id, topic: 'Core Concept Study', activityType: 'LEARN', isCompleted: false },
            { id: `slot-5`, startTime: '20:15', durationMinutes: 60, subjectId: sub2.id, topic: 'Revision (SRS System)', activityType: 'REVISION', isCompleted: false },
            { id: `slot-6`, startTime: '21:30', durationMinutes: 60, subjectId: 'self_analysis', topic: 'Day Analysis & Next Day Plan', activityType: 'TEST', isCompleted: false },
        ];

        setSlots(defaultSlots);
        localStorage.setItem(storedKey, JSON.stringify(defaultSlots));
    };

    // --- TIMER LOGIC ---
    useEffect(() => {
        let interval: any;
        if (timerActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && timerActive) {
            clearInterval(interval);
            alert("⏰ Time's Up! Take a 10 min break.");
            setTimerActive(null);
        }
        return () => clearInterval(interval);
    }, [timerActive, timeLeft]);

    const startTimer = (id: string, minutes: number) => {
        if (timerActive === id) {
            setTimerActive(null); // Pause
        } else {
            setTimerActive(id);
            setTimeLeft(minutes * 60);
        }
    };

    // --- ACTIONS ---
    const handleComplete = (id: string) => {
        const updated = slots.map(s => s.id === id ? { ...s, isCompleted: true, completedAt: new Date().toISOString() } : s);
        setSlots(updated);
        
        // Save to Local & Firebase
        const todayStr = new Date().toISOString().split('T')[0];
        localStorage.setItem(`nst_routine_${user.id}_${todayStr}`, JSON.stringify(updated));
        
        // Update Streak & Stats
        let newRoutine = { ...user.studyRoutine } || { streak: 0, bonusHolidays: 0, lastStudyDate: '', missedSlots: [], customSlots: [], dailyStats: {}, preferences: { startTime: '06:00', slotsPerDay: 6, difficultyRatings: {} } };
        
        // Streak Logic
        if (newRoutine.lastStudyDate !== todayStr) {
            newRoutine.streak = (newRoutine.streak || 0) + 1;
            newRoutine.lastStudyDate = todayStr;
        }
        
        // Bonus Logic (25 days)
        // ... (Simplified for now)

        const updatedUser = { ...user, studyRoutine: newRoutine as any };
        onUpdateUser(updatedUser);
        saveUserToLive(updatedUser);
    };

    const handleAddSlot = () => {
        if (!newSlotTime || !newSlotSubject) return;
        const newSlot: RoutineSlot = {
            id: `custom-${Date.now()}`,
            startTime: newSlotTime,
            durationMinutes: 60,
            subjectId: newSlotSubject,
            topic: 'Custom Study Slot',
            activityType: 'LEARN',
            isCompleted: false,
            isCustom: true
        };
        const updated = [...slots, newSlot].sort((a,b) => a.startTime.localeCompare(b.startTime));
        setSlots(updated);
        
        const todayStr = new Date().toISOString().split('T')[0];
        localStorage.setItem(`nst_routine_${user.id}_${todayStr}`, JSON.stringify(updated));
        setShowAddSlot(false);
    };

    const handleEditTime = (id: string) => {
        const newTime = prompt("Enter new time (HH:MM):");
        if (newTime) {
            const updated = slots.map(s => s.id === id ? { ...s, startTime: newTime } : s).sort((a,b) => a.startTime.localeCompare(b.startTime));
            setSlots(updated);
            const todayStr = new Date().toISOString().split('T')[0];
            localStorage.setItem(`nst_routine_${user.id}_${todayStr}`, JSON.stringify(updated));
        }
    };

    const getSubjectName = (id: string) => {
        if (id === 'current_affairs') return 'Current Affairs';
        if (id === 'self_analysis') return 'Self Analysis';
        const sub = getSubjectsList(user.classLevel || '10', null).find(s => s.id === id);
        return sub ? sub.name : id;
    };

    const formatTimeLeft = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <div className="bg-slate-50 min-h-screen pb-24 animate-in fade-in">
            {/* HEADER */}
            <div className="bg-white p-6 rounded-b-3xl shadow-sm border-b border-slate-100">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">
                            {isSundayMode ? 'Sunday Catch-Up' : 'Daily Routine'}
                        </h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-bold text-orange-500 flex items-center gap-1">
                                <Flame size={14} fill="currentColor" /> {user.studyRoutine?.streak || 0} Day Streak
                            </span>
                            <span className="text-[10px] text-slate-400">Target: 6 Hrs</span>
                        </div>
                    </div>
                </div>

                {/* STATS BAR */}
                <div className="flex gap-2">
                    <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <CheckCircle size={20} />
                        </div>
                        <div>
                            <p className="text-xl font-black text-slate-800">
                                {Math.round((slots.filter(s => s.isCompleted).length / (slots.length || 1)) * 100)}%
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Completed</p>
                        </div>
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                            <Shield size={20} />
                        </div>
                        <div>
                            <p className="text-xl font-black text-slate-800">{user.studyRoutine?.bonusHolidays || 0}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Bonus Holidays</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* TIMELINE */}
            <div className="p-4 space-y-4">
                {isSundayMode && slots.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-slate-400 font-bold">🎉 No backlog! Enjoy your holiday.</p>
                    </div>
                ) : (
                    slots.map((slot, index) => (
                        <div key={slot.id} className={`relative pl-6 pb-2 border-l-2 ${slot.isCompleted ? 'border-green-300' : 'border-slate-200'} last:border-0`}>
                            {/* TIME BUBBLE */}
                            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${
                                slot.isCompleted ? 'bg-green-500 border-green-500' : 
                                timerActive === slot.id ? 'bg-blue-500 border-blue-500 animate-pulse' : 'bg-white border-slate-300'
                            }`}></div>

                            <div className={`p-4 rounded-2xl border transition-all ${
                                slot.isCompleted ? 'bg-green-50 border-green-200 opacity-80' : 
                                timerActive === slot.id ? 'bg-white border-blue-400 shadow-md ring-1 ring-blue-100' : 'bg-white border-slate-200'
                            }`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold font-mono">
                                            {slot.startTime}
                                        </span>
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                            slot.activityType === 'REVISION' ? 'bg-yellow-100 text-yellow-700' :
                                            slot.activityType === 'TEST' ? 'bg-red-100 text-red-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                            {slot.activityType}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEditTime(slot.id)} className="text-slate-300 hover:text-blue-500"><Edit2 size={14} /></button>
                                    </div>
                                </div>

                                <h4 className="font-bold text-slate-800 text-lg mb-1">{getSubjectName(slot.subjectId)}</h4>
                                <p className="text-sm text-slate-500 mb-4">{slot.topic}</p>

                                {/* ACTION BAR */}
                                {!slot.isCompleted && (
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => startTimer(slot.id, slot.durationMinutes)}
                                            className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors ${
                                                timerActive === slot.id ? 'bg-orange-100 text-orange-700' : 'bg-slate-900 text-white hover:bg-slate-800'
                                            }`}
                                        >
                                            {timerActive === slot.id ? <><RotateCcw size={14} /> Stop ({formatTimeLeft(timeLeft)})</> : <><Play size={14} /> Start Timer</>}
                                        </button>
                                        <button 
                                            onClick={() => handleComplete(slot.id)}
                                            className="px-4 py-2 bg-green-100 text-green-700 rounded-xl font-bold text-xs hover:bg-green-200 flex items-center gap-2"
                                        >
                                            <CheckSquare size={16} /> Done
                                        </button>
                                    </div>
                                )}
                                {slot.isCompleted && (
                                    <div className="text-xs text-green-600 font-bold flex items-center gap-1">
                                        <CheckCircle size={14} /> Completed
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* ADD SLOT BUTTON */}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30">
                <button 
                    onClick={() => setShowAddSlot(true)} 
                    className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                >
                    <Plus size={20} /> Add Slot
                </button>
            </div>

            {/* ADD SLOT MODAL */}
            {showAddSlot && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
                        <h3 className="font-bold text-lg mb-4">Add Custom Slot</h3>
                        <div className="space-y-3 mb-6">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Time</label>
                                <input type="time" value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)} className="w-full p-3 border rounded-xl font-bold" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                                <select value={newSlotSubject} onChange={e => setNewSlotSubject(e.target.value)} className="w-full p-3 border rounded-xl">
                                    <option value="">Select Subject</option>
                                    {getSubjectsList(user.classLevel || '10', user.stream || null).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                    <option value="revision">Revision</option>
                                    <option value="extra">Extra Activity</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowAddSlot(false)} className="flex-1 py-3 text-slate-500 font-bold">Cancel</button>
                            <button onClick={handleAddSlot} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold">Add to Routine</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
