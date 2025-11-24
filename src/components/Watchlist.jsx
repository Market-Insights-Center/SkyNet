import React, { useState, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MoreVertical, Plus, Search, GripVertical, X, ChevronDown, ChevronUp, Edit2, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Initial Data: Magnificent Seven
const INITIAL_TICKERS = [
    { id: 'AAPL', symbol: 'AAPL', name: 'Apple Inc.', price: 185.92, change: 1.25, marketCap: '2.8T', volume: '52.4M', iv: '18.5%', earnings: 'May 2', yearChange: 15.4, fiveYearChange: 250.1 },
    { id: 'MSFT', symbol: 'MSFT', name: 'Microsoft Corp.', price: 415.50, change: 0.85, marketCap: '3.1T', volume: '22.1M', iv: '21.2%', earnings: 'Apr 25', yearChange: 45.2, fiveYearChange: 180.5 },
    { id: 'GOOG', symbol: 'GOOG', name: 'Alphabet Inc.', price: 172.35, change: -0.45, marketCap: '1.9T', volume: '18.9M', iv: '24.1%', earnings: 'Apr 23', yearChange: 25.8, fiveYearChange: 150.3 },
    { id: 'AMZN', symbol: 'AMZN', name: 'Amazon.com Inc.', price: 178.15, change: 2.10, marketCap: '1.8T', volume: '35.6M', iv: '28.4%', earnings: 'Apr 30', yearChange: 60.1, fiveYearChange: 120.4 },
    { id: 'NVDA', symbol: 'NVDA', name: 'NVIDIA Corp.', price: 925.60, change: 3.45, marketCap: '2.2T', volume: '45.2M', iv: '45.6%', earnings: 'May 22', yearChange: 210.5, fiveYearChange: 1800.2 },
    { id: 'META', symbol: 'META', name: 'Meta Platforms', price: 485.20, change: -1.15, marketCap: '1.2T', volume: '15.8M', iv: '32.5%', earnings: 'Apr 24', yearChange: 140.2, fiveYearChange: 160.8 },
    { id: 'TSLA', symbol: 'TSLA', name: 'Tesla Inc.', price: 175.30, change: -2.50, marketCap: '0.6T', volume: '85.4M', iv: '55.2%', earnings: 'Apr 17', yearChange: -25.4, fiveYearChange: 800.5 },
];

const AVAILABLE_COLUMNS = [
    { id: 'price', label: 'Price' },
    { id: 'change', label: '1D %' },
    { id: 'marketCap', label: 'Market Cap' },
    { id: 'volume', label: 'Volume' },
    { id: 'iv', label: 'IV' },
    { id: 'earnings', label: 'Earnings Date' },
    { id: 'weekChange', label: '1W %' },
    { id: 'monthChange', label: '1M %' },
    { id: 'ytdChange', label: 'YTD %' },
    { id: 'yearChange', label: '1Y %' },
    { id: 'fiveYearChange', label: '5Y %' },
    { id: 'peRatio', label: 'P/E Ratio' },
];

const DEFAULT_COLUMNS = [
    { id: 'price', label: 'Price' },
    { id: 'change', label: '1D %' },
    { id: 'marketCap', label: 'Market Cap' },
];

const SortableHeader = ({ column, onToggle, isEditing, sortConfig, onSort }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: column.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab'
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="flex items-center gap-1 relative group hover:text-gold transition-colors select-none"
            onClick={() => !isEditing && onSort(column.id)}
        >
            {isEditing && (
                <button
                    onClick={(e) => { e.stopPropagation(); onToggle(column); }}
                    className="mr-1 text-red-400 hover:text-red-300"
                >
                    <X size={12} />
                </button>
            )}
            {sortConfig.key === column.id && (
                sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-gold" /> :
                    sortConfig.direction === 'desc' ? <ChevronDown size={12} className="text-gold" /> : null
            )}
            {column.label}
        </div>
    );
};

const SortableRow = ({ ticker, columns, onDelete }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: ticker.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={{
                ...style,
                gridTemplateColumns: `40px 200px ${columns.map(() => '1fr').join(' ')} 40px`
            }}
            className="grid items-center gap-4 p-4 bg-white/5 border-b border-white/5 hover:bg-white/10 transition-colors group relative"
        >
            <div {...attributes} {...listeners} className="cursor-grab text-gray-500 hover:text-gold">
                <GripVertical size={20} />
            </div>

            {/* Ticker & Name */}
            <div>
                <div className="font-bold text-white text-lg">{ticker.symbol}</div>
                <div className="text-xs text-gray-500">{ticker.name}</div>
            </div>

            {/* Dynamic Columns */}
            {columns.map((col) => (
                <div key={col.id} className={`text-sm font-medium ${col.id === 'change' ? (ticker.change >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-300'}`}>
                    {col.id === 'change' ? (
                        <div className="flex flex-col">
                            <span className={ticker.change >= 0 ? 'text-green-400' : 'text-red-400'}>{ticker.price}</span>
                            <span className={ticker.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                                {ticker.change > 0 ? '+' : ''}{ticker.change}%
                            </span>
                        </div>
                    ) : col.id === 'price' ? (
                        <span className={ticker.change >= 0 ? 'text-green-400' : 'text-red-400'}>{ticker.price}</span>
                    ) : (
                        ticker[col.id] || '-'
                    )}
                </div>
            ))}

            {/* Actions */}
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(ticker.id); }}
                className="absolute right-4 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-2"
                title="Remove from watchlist"
            >
                <X size={20} />
            </button>
        </div>
    );
};

const Watchlist = () => {
    const { currentUser } = useAuth();
    const [tickers, setTickers] = useState(INITIAL_TICKERS);
    const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
    const [watchlistName, setWatchlistName] = useState("My Watchlist");
    const [isEditingName, setIsEditingName] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'none' }); // 'asc', 'desc', 'none'
    const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
    const [isEditingColumns, setIsEditingColumns] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Load from Firestore
    useEffect(() => {
        if (!currentUser) return;
        const loadData = async () => {
            try {
                const docRef = doc(db, "users", currentUser.uid, "watchlists", "default");
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.tickers) setTickers(data.tickers);
                    if (data.visibleColumns) setVisibleColumns(data.visibleColumns);
                    if (data.name) setWatchlistName(data.name);
                }
            } catch (err) {
                console.error("Error loading watchlist:", err);
            }
        };
        loadData();
    }, [currentUser]);

    // Save to Firestore (Debounced)
    useEffect(() => {
        if (!currentUser) return;
        const saveData = setTimeout(async () => {
            try {
                const docRef = doc(db, "users", currentUser.uid, "watchlists", "default");
                await setDoc(docRef, {
                    tickers,
                    visibleColumns,
                    name: watchlistName,
                    updatedAt: new Date()
                });
            } catch (err) {
                console.error("Error saving watchlist:", err);
            }
        }, 1000);
        return () => clearTimeout(saveData);
    }, [tickers, visibleColumns, watchlistName, currentUser]);

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over) return;

        const isColumn = visibleColumns.some(c => c.id === active.id);

        if (isColumn) {
            if (active.id !== over.id) {
                setVisibleColumns((items) => {
                    const oldIndex = items.findIndex((item) => item.id === active.id);
                    const newIndex = items.findIndex((item) => item.id === over.id);
                    return arrayMove(items, oldIndex, newIndex);
                });
            }
        } else {
            if (active.id !== over.id) {
                setTickers((items) => {
                    const oldIndex = items.findIndex((item) => item.id === active.id);
                    const newIndex = items.findIndex((item) => item.id === over.id);
                    return arrayMove(items, oldIndex, newIndex);
                });
            }
        }
    };

    const handleSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key) {
            if (sortConfig.direction === 'desc') direction = 'asc';
            else if (sortConfig.direction === 'asc') direction = 'none';
        }
        setSortConfig({ key, direction });

        if (direction === 'none') {
            // Reset to original order (mock implementation: just by ID or symbol for now)
            setTickers([...tickers].sort((a, b) => a.id.localeCompare(b.id)));
        } else {
            const sorted = [...tickers].sort((a, b) => {
                let valA = a[key];
                let valB = b[key];

                // Handle numeric strings like "2.8T" or "52.4M"
                if (typeof valA === 'string' && valA.match(/[0-9]/)) {
                    valA = parseFloat(valA.replace(/[^0-9.-]+/g, ""));
                    valB = parseFloat(valB.replace(/[^0-9.-]+/g, ""));
                }

                if (valA < valB) return direction === 'asc' ? -1 : 1;
                if (valA > valB) return direction === 'asc' ? 1 : -1;
                return 0;
            });
            setTickers(sorted);
        }
    };

    const handleAddTicker = async (e) => {
        e.preventDefault();
        if (!searchQuery) return;
        const upperQuery = searchQuery.toUpperCase();

        if (tickers.some(t => t.symbol === upperQuery)) {
            // Ideally show a toast, but alert is fine for now
            alert("Ticker already in watchlist!");
            setSearchQuery('');
            return;
        }

        // Mock Ticker Data
        const newTicker = {
            id: upperQuery,
            symbol: upperQuery,
            name: `${upperQuery} Corp`,
            price: '...',
            change: 0,
            marketCap: '-',
            volume: '-',
            iv: '-',
            earnings: '-',
            yearChange: 0,
            fiveYearChange: 0
        };

        setTickers(prev => [...prev, newTicker]);
        setSearchQuery('');
        setIsAddOpen(false);

        // Fetch Real Data
        try {
            const response = await fetch('http://localhost:8000/api/market-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tickers: [upperQuery] })
            });
            const data = await response.json();
            const update = data[upperQuery];

            if (update && !update.error) {
                setTickers(prev => prev.map(t => {
                    if (t.id === upperQuery) {
                        return { ...t, ...update };
                    }
                    return t;
                }));
            }
        } catch (err) {
            console.error("Failed to fetch ticker data:", err);
        }
    };

    const toggleColumn = (column) => {
        if (visibleColumns.find(c => c.id === column.id)) {
            setVisibleColumns(visibleColumns.filter(c => c.id !== column.id));
        } else {
            setVisibleColumns([...visibleColumns, column]);
        }
    };

    const removeTicker = (id) => {
        setTickers(tickers.filter(t => t.id !== id));
    };

    return (
        <section className="py-12 px-4 bg-deep-black">
            <div className="max-w-7xl mx-auto">
                <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex justify-between items-center">
                        {isEditingName ? (
                            <form onSubmit={(e) => { e.preventDefault(); setIsEditingName(false); }} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={watchlistName}
                                    onChange={(e) => setWatchlistName(e.target.value)}
                                    className="bg-transparent border-b border-gold text-2xl font-bold text-gold focus:outline-none"
                                    autoFocus
                                    onBlur={() => setIsEditingName(false)}
                                />
                                <button type="submit" className="text-green-400"><Check size={20} /></button>
                            </form>
                        ) : (
                            <h2
                                onDoubleClick={() => setIsEditingName(true)}
                                className="text-2xl font-bold text-gold cursor-pointer hover:text-yellow-400 transition-colors select-none"
                                title="Double click to edit"
                            >
                                {watchlistName}
                            </h2>
                        )}
                    </div>

                    <DndContext
                        onDragEnd={handleDragEnd}
                        sensors={sensors}
                        collisionDetection={closestCenter}
                    >
                        {/* Table Header */}
                        <div className="grid gap-4 p-4 bg-white/5 border-b border-white/10 text-xs font-bold text-gray-400 uppercase tracking-wider"
                            style={{ gridTemplateColumns: `40px 200px ${visibleColumns.map(() => '1fr').join(' ')} 40px` }}>
                            <div></div>
                            <div
                                className="cursor-pointer hover:text-gold flex items-center gap-1"
                                onClick={() => handleSort('symbol')}
                            >
                                {sortConfig.key === 'symbol' && (
                                    sortConfig.direction === 'asc' ? <ChevronUp size={12} className="text-gold" /> :
                                        sortConfig.direction === 'desc' ? <ChevronDown size={12} className="text-gold" /> : null
                                )}
                                Ticker
                            </div>

                            <SortableContext items={visibleColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                                {visibleColumns.map(col => (
                                    <SortableHeader
                                        key={col.id}
                                        column={col}
                                        onToggle={toggleColumn}
                                        isEditing={isEditingColumns}
                                        sortConfig={sortConfig}
                                        onSort={handleSort}
                                    />
                                ))}
                            </SortableContext>

                            {/* Column Menu */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
                                    className="hover:text-white"
                                >
                                    <MoreVertical size={16} />
                                </button>
                                {isColumnMenuOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-50 p-2">
                                        <button
                                            onClick={() => { setIsEditingColumns(!isEditingColumns); setIsColumnMenuOpen(false); }}
                                            className="w-full text-left px-3 py-2 hover:bg-white/5 rounded text-sm text-gray-300 mb-1"
                                        >
                                            {isEditingColumns ? 'Done Editing' : 'Edit Columns'}
                                        </button>
                                        <div className="h-px bg-white/10 my-1" />
                                        <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                            {AVAILABLE_COLUMNS.map(col => (
                                                <div
                                                    key={col.id}
                                                    onClick={() => toggleColumn(col)}
                                                    className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded cursor-pointer text-sm text-gray-300"
                                                >
                                                    <div className={`w-4 h-4 rounded border ${visibleColumns.find(c => c.id === col.id) ? 'bg-gold border-gold' : 'border-gray-500'}`}>
                                                        {visibleColumns.find(c => c.id === col.id) && <Check size={14} className="text-black" />}
                                                    </div>
                                                    {col.label}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Table Body */}
                        <SortableContext items={tickers.map(t => t.id)} strategy={verticalListSortingStrategy}>
                            <div className="divide-y divide-white/5">
                                {tickers.map((ticker) => (
                                    <SortableRow
                                        key={ticker.id}
                                        ticker={ticker}
                                        columns={visibleColumns}
                                        onDelete={removeTicker}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>

                    {/* Add Ticker Footer */}
                    <div className="p-4 bg-white/5 border-t border-white/10">
                        {isAddOpen ? (
                            <form onSubmit={handleAddTicker} className="flex items-center gap-2">
                                <Search size={20} className="text-gray-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search ticker (e.g. AAPL)..."
                                    className="bg-transparent border-none text-white focus:outline-none flex-1"
                                    autoFocus
                                    onBlur={() => !searchQuery && setIsAddOpen(false)}
                                />
                                <button type="submit" className="text-gold font-bold text-sm">ADD</button>
                            </form>
                        ) : (
                            <button
                                onClick={() => setIsAddOpen(true)}
                                className="flex items-center gap-2 text-gray-500 hover:text-gold transition-colors w-full"
                            >
                                <Plus size={20} />
                                <span className="font-medium">Add Ticker</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Watchlist;
