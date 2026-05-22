import { useEffect, useRef, useState } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter } from 'vexflow';

const TREBLE_FREQUENCIES = {
    'c/4': 261.63, 'd/4': 293.66, 'e/4': 329.63, 'f/4': 349.23,
    'g/4': 392.00, 'a/4': 440.00, 'b/4': 493.88, 'c/5': 523.25,
};

const BASS_FREQUENCIES = {
    'c/3': 130.81, 'd/3': 146.83, 'e/3': 164.81, 'f/3': 174.61,
    'g/3': 196.00, 'a/3': 220.00, 'b/3': 246.94, 'c/4': 261.63,
};

const NOTE_LABELS = {
    'c/4': 'До', 'd/4': 'Ре', 'e/4': 'Мі', 'f/4': 'Фа', 'g/4': 'Соль', 'a/4': 'Ля', 'b/4': 'Сі', 'c/5': 'До (вгорі)',
    'c/3': 'До', 'd/3': 'Ре', 'e/3': 'Мі', 'f/3': 'Фа', 'g/3': 'Соль', 'a/3': 'Ля', 'b/3': 'Сі',
};

const DURATION_RATIOS = { 'w': 1.0, 'h': 0.5, 'q': 0.25, '8': 0.125 };

function App() {
    const containerRef = useRef(null);
    const fileInputRef = useRef(null);

    const [clef, setClef] = useState('treble');
    const [bpm, setBpm] = useState(120);
    const [notes, setNotes] = useState([
        { keys: ['c/4'], duration: 'q', isRest: false },
        { keys: ['d/4'], duration: 'q', isRest: false },
        { keys: ['b/4'], duration: 'qr', isRest: true },
        { keys: ['e/4'], duration: 'h', isRest: false },
    ]);

    const [selectedDuration, setSelectedDuration] = useState('q');
    const [isRestMode, setIsRestMode] = useState(false);

    // Стани для Бази Даних та Каталогізації
    const [scoreTitle, setScoreTitle] = useState('Моя нова мелодія');
    const [folders, setFolders] = useState([]);
    const [scores, setScores] = useState([]);
    const [newFolderName, setNewFolderName] = useState('');
    const [selectedFolderId, setSelectedFolderId] = useState('');

    // Стани для Пошуку та Заміни нот
    const [searchNote, setSearchNote] = useState('');
    const [replaceNote, setReplaceNote] = useState('');

    const currentFrequencies = clef === 'treble' ? TREBLE_FREQUENCIES : BASS_FREQUENCIES;

    // Автоматичне встановлення перших значень для пошуку при зміні ключа
    useEffect(() => {
        const keys = Object.keys(currentFrequencies);
        setSearchNote(keys[0]);
        setReplaceNote(keys[2] || keys[0]);
    }, [clef]);

    const fetchData = async () => {
        try {
            const foldersRes = await fetch('http://127.0.0.1:8000/folders/');
            if (foldersRes.ok) {
                const fData = await foldersRes.json();
                setFolders(Array.isArray(fData) ? fData : []);
            }

            const scoresRes = await fetch('http://127.0.0.1:8000/scores/');
            if (scoresRes.ok) {
                const sData = await scoresRes.json();
                setScores(Array.isArray(sData) ? sData : []);
            }
        } catch (error) {
            console.error('Помилка завантаження даних:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (containerRef.current) containerRef.current.innerHTML = '';
        const div = containerRef.current;
        if (!div || notes.length === 0) return;

        const staveWidth = Math.max(450, notes.length * 65 + 120);
        const renderer = new Renderer(div, Renderer.Backends.SVG);
        renderer.resize(staveWidth + 50, 200);
        const context = renderer.getContext();

        const stave = new Stave(10, 40, staveWidth).addClef(clef).addTimeSignature('4/4');
        stave.setContext(context).draw();

        const staveNotes = notes.map(n => new StaveNote({ keys: n.keys, duration: n.duration, clef: clef }));
        const voice = new Voice({ num_beats: 4, beat_value: 4 }).setStrict(false).addTickables(staveNotes);

        new Formatter().joinVoices([voice]).format([voice], staveWidth - 100);
        voice.draw(context, stave);
    }, [notes, clef]);

    const handleClefChange = (newClef) => { setClef(newClef); setNotes([]); };
    const removeLastNote = () => setNotes(notes.slice(0, -1));
    const clearNotes = () => setNotes([]);

    const handleAddElement = (noteKey) => {
        let newElement;
        if (isRestMode) {
            const restKey = clef === 'treble' ? 'b/4' : 'd/3';
            newElement = { keys: [restKey], duration: selectedDuration + 'r', isRest: true };
        } else {
            newElement = { keys: [noteKey], duration: selectedDuration, isRest: false };
            const durationSeconds = (60 / bpm) * (DURATION_RATIOS[selectedDuration] / DURATION_RATIOS['q']);
            playTone(currentFrequencies[noteKey], durationSeconds);
        }
        setNotes([...notes, newElement]);
    };

    // --- ФУНКЦІЯ ПОШУКУ ТА ЗАМІНИ НОТ ---
    const handleSearchAndReplace = () => {
        if (notes.length === 0) return alert('Мелодія порожня!');

        let count = 0;
        const updatedNotes = notes.map(note => {
            // Замінюємо тільки ноти, ігноруємо паузи
            if (!note.isRest && note.keys.includes(searchNote)) {
                count++;
                return { ...note, keys: [replaceNote] };
            }
            return note;
        });

        if (count === 0) {
            alert(`Ноту "${NOTE_LABELS[searchNote]}" не знайдено у поточній мелодії.`);
        } else {
            setNotes(updatedNotes);
            alert(`Успішно замінено ноту "${NOTE_LABELS[searchNote]}" на "${NOTE_LABELS[replaceNote]}" у такій кількості місць: ${count}`);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return alert('Введіть назву папки');
        try {
            const response = await fetch('http://127.0.0.1:8000/folders/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newFolderName })
            });
            if (response.ok) {
                setNewFolderName('');
                fetchData();
            }
        } catch (error) {
            alert('Не вдалося створити папку');
        }
    };

    const handleDeleteFolder = async (folderId) => {
        if (!window.confirm('Ви впевнені, що хочете видалити цю папку? Всі мелодії з неї перейдуть у "Загальні файли".')) return;
        try {
            const response = await fetch(`http://127.0.0.1:8000/folders/${folderId}`, {
                method: 'DELETE'
            });
            if (response.ok) fetchData();
        } catch (error) {
            alert('Не вдалося видалити папку');
        }
    };

    // --- API: ВИДАТИ ОКРЕМУ МЕЛОДІЮ ---
    const handleDeleteScore = async (scoreId) => {
        if (!window.confirm('Ви впевнені, що хочете назавжди видалити цю мелодію з бази?')) return;
        try {
            const response = await fetch(`http://127.0.0.1:8000/scores/${scoreId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                fetchData(); // Перезавантажуємо каталог
            } else {
                alert('Помилка при видаленні файлу');
            }
        } catch (error) {
            alert('Не вдалося зв’язатися з сервером');
        }
    };

    const saveToDatabase = async () => {
        const dataStr = JSON.stringify({ clef, bpm, notes });
        try {
            const response = await fetch('http://127.0.0.1:8000/scores/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: scoreTitle,
                    content_xml: dataStr,
                    folder_id: selectedFolderId ? Number(selectedFolderId) : null
                })
            });
            if (response.ok) {
                alert('Партитуру успішно збережено!');
                fetchData();
            }
        } catch (error) {
            alert('Помилка підключення до сервера');
        }
    };

    const loadFromDatabase = (score) => {
        try {
            const parsedData = JSON.parse(score.content_xml);
            setClef(parsedData.clef || 'treble');
            setBpm(parsedData.bpm || 120);
            setNotes(parsedData.notes || []);
            setScoreTitle(score.title);
        } catch (error) {
            alert('Помилка читання партитури');
        }
    };

    const exportToJSON = () => {
        const dataStr = JSON.stringify({ clef, bpm, notes }, null, 2);
        const url = URL.createObjectURL(new Blob([dataStr], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url; link.download = `${scoreTitle}.json`; link.click();
        URL.revokeObjectURL(url);
    };

    const handleImportJSON = (event) => {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                setClef(parsed.clef); setBpm(parsed.bpm); setNotes(parsed.notes);
            } catch { alert('Помилка імпорту'); }
        };
        reader.readAsText(file); event.target.value = '';
    };

    const playTone = (frequency, durationSeconds) => {
        if (!frequency) return;
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durationSeconds);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + durationSeconds);
    };

    const playMelody = () => {
        if (notes.length === 0) return;
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let startTime = audioCtx.currentTime;
        notes.forEach((n) => {
            const pureDuration = n.duration.replace('r', '');
            const durSec = (60 / bpm) * (DURATION_RATIOS[pureDuration] / DURATION_RATIOS['q']);
            if (!n.isRest && currentFrequencies[n.keys[0]]) {
                const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
                osc.type = 'sine'; osc.frequency.setValueAtTime(currentFrequencies[n.keys[0]], startTime);
                gain.gain.setValueAtTime(0.2, startTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durSec);
                osc.connect(gain); gain.connect(audioCtx.destination);
                osc.start(startTime); osc.stop(startTime + durSec);
            }
            startTime += durSec;
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', padding: '30px', backgroundColor: '#f3f4f6', fontFamily: 'sans-serif' }}>
            <h1 style={{ color: '#4f46e5', marginBottom: '20px' }}>Музичний Редактор Pro 🎼</h1>

            {/* ПАНЕЛЬ НАЛАШТУВАНЬ */}
            <div style={{ display: 'flex', gap: '25px', backgroundColor: '#fff', padding: '15px 25px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                    <span style={{ marginRight: '10px', fontWeight: 'bold' }}>Ключ:</span>
                    <select value={clef} onChange={(e) => handleClefChange(e.target.value)} style={selectStyle}>
                        <option value="treble">🎼 Скрипковий</option><option value="bass">𝄢 Басовий</option>
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 'bold' }}>Темп: {bpm}</span>
                    <input type="range" min="60" max="180" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} />
                </div>
                <div>
                    <span style={{ marginRight: '10px', fontWeight: 'bold' }}>Тривалість:</span>
                    <select value={selectedDuration} onChange={(e) => setSelectedDuration(e.target.value)} style={selectStyle}>
                        <option value="w">Ціла</option><option value="h">Половинна</option><option value="q">Четвертна</option><option value="8">Восьма</option>
                    </select>
                </div>
                <div>
                    <input type="checkbox" id="restMode" checked={isRestMode} onChange={(e) => setIsRestMode(e.target.checked)} />
                    <label htmlFor="restMode" style={{ fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px' }}>Пауза 🛑</label>
                </div>
            </div>

            {/* КНОПКИ НОТ */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
                {Object.keys(currentFrequencies).map(key => (
                    <button key={key} onClick={() => handleAddElement(key)} disabled={isRestMode} style={{ ...btnStyle, backgroundColor: isRestMode ? '#9ca3af' : '#4f46e5' }}>
                        {NOTE_LABELS[key] || key}
                    </button>
                ))}
                {isRestMode && (
                    <button onClick={() => handleAddElement(clef === 'treble' ? 'b/4' : 'd/3')} style={{ ...btnStyle, backgroundColor: '#06b6d4', padding: '10px 20px' }}>
                        Додати паузу ➕
                    </button>
                )}
            </div>

            {/* ПАНЕЛЬ ПОШУКУ ТА ЗАМІНИ НОТ (НОВА ФІЧА) */}
            <div style={{ display: 'flex', gap: '10px', backgroundColor: '#fef3c7', padding: '10px 20px', borderRadius: '10px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap', border: '1px solid #fcd34d' }}>
                <span style={{ fontWeight: 'bold', color: '#92400e', fontSize: '13px' }}>🔍 Пошук та заміна:</span>
                <select value={searchNote} onChange={(e) => setSearchNote(e.target.value)} style={selectStyle}>
                    {Object.keys(currentFrequencies).map(k => <option key={k} value={k}>Знайти {NOTE_LABELS[k]}</option>)}
                </select>
                <span style={{ fontWeight: 'bold', color: '#92400e' }}>➔</span>
                <select value={replaceNote} onChange={(e) => setReplaceNote(e.target.value)} style={selectStyle}>
                    {Object.keys(currentFrequencies).map(k => <option key={k} value={k}>Замінити на {NOTE_LABELS[k]}</option>)}
                </select>
                <button onClick={handleSearchAndReplace} style={{ ...btnStyle, backgroundColor: '#d97706' }}>Замінити все ⚡</button>
            </div>

            {/* КЕРУВАННЯ */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button onClick={playMelody} style={{ ...btnStyle, backgroundColor: '#10b981' }}>Програти ▶️</button>
                <button onClick={removeLastNote} style={{ ...btnStyle, backgroundColor: '#f59e0b' }}>Видалити ⌫</button>
                <button onClick={clearNotes} style={{ ...btnStyle, backgroundColor: '#ef4444' }}>Очистити ❌</button>
                <button onClick={exportToJSON} style={{ ...btnStyle, backgroundColor: '#3b82f6' }}>Експорт 💾</button>
                <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportJSON} style={{ display: 'none' }} />
                <button onClick={() => fileInputRef.current.click()} style={{ ...btnStyle, backgroundColor: '#8b5cf6' }}>Імпорт 📂</button>
            </div>

            {/* ФОРМА ЗБЕРЕЖЕННЯ */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center', backgroundColor: '#e0e7ff', padding: '15px 25px', borderRadius: '12px', flexWrap: 'wrap' }}>
                <div>
                    <span style={{ fontWeight: 'bold', color: '#3730a3', marginRight: '5px' }}>Назва:</span>
                    <input type="text" value={scoreTitle} onChange={(e) => setScoreTitle(e.target.value)} style={inputStyle} />
                </div>
                <div>
                    <span style={{ fontWeight: 'bold', color: '#3730a3', marginRight: '5px' }}>Папка:</span>
                    <select value={selectedFolderId} onChange={(e) => setSelectedFolderId(e.target.value)} style={selectStyle}>
                        <option value="">📁 Корінь (без папки)</option>
                        {folders.map(f => <option key={f.id} value={f.id}>📁 {f.name}</option>)}
                    </select>
                </div>
                <button onClick={saveToDatabase} style={{ ...btnStyle, backgroundColor: '#4338ca' }}>Зберегти в БД ☁️</button>
            </div>

            {/* ПОЛОТНО */}
            <div style={{ padding: '25px', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflowX: 'auto', maxWidth: '100%', marginBottom: '30px' }}>
                <div ref={containerRef}></div>
            </div>

            {/* КАТАЛОГ ПРОЕКТІВ */}
            <div style={{ width: '100%', maxWidth: '800px', backgroundColor: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <h2 style={{ fontSize: '20px', color: '#1f2937', marginBottom: '15px' }}>📁 Каталог проектів</h2>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
                    <input type="text" placeholder="Нова папка (напр. Етюди)..." value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} style={inputStyle} />
                    <button onClick={handleCreateFolder} style={{ ...btnStyle, backgroundColor: '#4b5563' }}>Створити папку ➕</button>
                </div>

                <div>
                    {folders.map(folder => {
                        const folderScores = scores.filter(s => s.folder_id === folder.id);
                        return (
                            <div key={folder.id} style={{ marginBottom: '15px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <h3 style={{ margin: 0, color: '#374151', fontSize: '16px' }}>📁 {folder.name}</h3>
                                    <button onClick={() => handleDeleteFolder(folder.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                                        Видалити папку 🗑️
                                    </button>
                                </div>

                                {folderScores.length === 0 ? (
                                    <p style={{ margin: 0, color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>Папка порожня</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '15px' }}>
                                        {folderScores.map(score => (
                                            <div key={score.id} style={scoreRowStyle}>
                                                <span>🎵 {score.title}</span>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => loadFromDatabase(score)} style={loadBtnStyle}>Завантажити</button>
                                                    <button onClick={() => handleDeleteScore(score.id)} style={deleteBtnStyle}>Видалити ❌</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    <div style={{ border: '1px dashed #d1d5db', borderRadius: '8px', padding: '12px', marginTop: '15px' }}>
                        <h3 style={{ margin: '0 0 10px 0', color: '#6b7280', fontSize: '16px' }}>🌐 Загальні файли (без папки)</h3>
                        {scores.filter(s => s.folder_id === null).length === 0 ? (
                            <p style={{ margin: 0, color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>Немає загальних файлів</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {scores.filter(s => s.folder_id === null).map(score => (
                                    <div key={score.id} style={scoreRowStyle}>
                                        <span>🎵 {score.title}</span>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => loadFromDatabase(score)} style={loadBtnStyle}>Завантажити</button>
                                            <button onClick={() => handleDeleteScore(score.id)} style={deleteBtnStyle}>Видалити ❌</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const btnStyle = { padding: '10px 16px', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' };
const selectStyle = { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff', cursor: 'pointer', fontWeight: '500' };
const inputStyle = { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' };
const scoreRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', padding: '8px 12px', borderRadius: '6px' };
const loadBtnStyle = { padding: '5px 10px', backgroundColor: '#14b8a6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' };
const deleteBtnStyle = { padding: '5px 10px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' };

export default App;