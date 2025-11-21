import React, { useState } from 'react';
import { Info } from 'lucide-react';

const InputGroup = ({ label, children, tooltip }) => (
    <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">{label}</label>
            {tooltip && <Info size={14} className="text-gray-500 hover:text-gold cursor-help" />}
        </div>
        {children}
    </div>
);

const TextInput = ({ placeholder, defaultValue, onChange }) => (
    <input
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        onChange={(e) => onChange && onChange(e.target.value)}
        className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-royal-purple focus:ring-1 focus:ring-royal-purple outline-none transition-all duration-300 placeholder-gray-600"
    />
);

const SelectInput = ({ options, onChange }) => (
    <div className="relative">
        <select
            onChange={(e) => onChange && onChange(e.target.value)}
            className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-royal-purple focus:ring-1 focus:ring-royal-purple outline-none appearance-none cursor-pointer transition-all duration-300"
        >
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
    </div>
);

const SliderInput = ({ min, max, defaultValue, unit = '', step = 1, onChange }) => {
    const [val, setVal] = useState(defaultValue);
    return (
        <div>
            <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>{min}{unit}</span>
                <span className="text-gold font-bold">{val}{unit}</span>
                <span>{max}{unit}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={val}
                onChange={(e) => {
                    setVal(e.target.value);
                    if (onChange) onChange(e.target.value);
                }}
                className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-gold"
            />
        </div>
    );
};

const ToggleSwitch = ({ label, onChange }) => {
    const [active, setActive] = useState(false);
    return (
        <div className="flex items-center justify-between p-4 bg-black/50 rounded-lg border border-gray-800">
            <span className="text-sm text-gray-300">{label}</span>
            <button
                onClick={() => {
                    const newState = !active;
                    setActive(newState);
                    if (onChange) onChange(newState);
                }}
                className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${active ? 'bg-gold' : 'bg-gray-700'}`}
            >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${active ? 'left-7' : 'left-1'}`} />
            </button>
        </div>
    );
};

const WizardInputs = ({ toolType, onChange }) => {
    // Helper to handle changes for a specific field
    const handleChange = (field, value) => {
        if (onChange) {
            onChange(field, value);
        }
    };

    switch (toolType) {
        case 'custom':
            return (
                <>
                    <InputGroup label="Portfolio Name">
                        <TextInput
                            placeholder="e.g., Alpha Strategy V1"
                            onChange={(val) => handleChange('name', val)}
                        />
                    </InputGroup>
                    <InputGroup label="Sensitivity Level">
                        <SliderInput
                            min={1} max={10} defaultValue={5}
                            onChange={(val) => handleChange('sensitivity', val)}
                        />
                    </InputGroup>
                    <InputGroup label="Amplification Factor">
                        <SliderInput
                            min={1} max={3} defaultValue={1.5} unit="x" step={0.5}
                            onChange={(val) => handleChange('amplification', val)}
                        />
                    </InputGroup>
                    <InputGroup label="Sub-portfolios">
                        <SelectInput
                            options={['Conservative', 'Balanced', 'Aggressive', 'Custom Mix']}
                            onChange={(val) => handleChange('sub_portfolios', val)}
                        />
                    </InputGroup>
                    <ToggleSwitch
                        label="Enable Auto-Rebalancing"
                        onChange={(val) => handleChange('auto_rebalance', val)}
                    />
                </>
            );

        case 'invest':
            return (
                <>
                    <InputGroup label="Tickers (Comma Separated)">
                        <TextInput
                            placeholder="AAPL, MSFT, GOOGL"
                            onChange={(val) => handleChange('tickers', val.split(',').map(t => t.trim()))}
                        />
                    </InputGroup>
                    <InputGroup label="EMA Sensitivity">
                        <SelectInput
                            options={['Low (Long-term)', 'Medium (Swing)', 'High (Day Trade)']}
                            onChange={(val) => handleChange('sensitivity', val)}
                        />
                    </InputGroup>
                    <InputGroup label="Amplification">
                        <SliderInput
                            min={1} max={5} defaultValue={1} unit="x" step={0.5}
                            onChange={(val) => handleChange('amplification', val)}
                        />
                    </InputGroup>
                </>
            );

        case 'cultivate':
            return (
                <>
                    <InputGroup label="Strategy Code">
                        <SelectInput
                            options={['Strategy A (Growth)', 'Strategy B (Value)', 'Strategy C (Yield)']}
                            onChange={(val) => handleChange('strategy_code', val)}
                        />
                    </InputGroup>
                    <InputGroup label="Total Portfolio Value ($)">
                        <TextInput
                            placeholder="10000" defaultValue="50000"
                            onChange={(val) => handleChange('capital', parseFloat(val) || 0)}
                        />
                    </InputGroup>
                    <InputGroup label="Risk Tolerance">
                        <SliderInput
                            min={1} max={10} defaultValue={7}
                            onChange={(val) => handleChange('risk_tolerance', val)}
                        />
                    </InputGroup>
                </>
            );

        case 'tracking':
            return (
                <>
                    <InputGroup label="Select Portfolio">
                        <SelectInput
                            options={['Main Holdings', 'Speculative Tech', 'Dividend Aristocrats']}
                            onChange={(val) => handleChange('portfolio_id', val)}
                        />
                    </InputGroup>
                    <InputGroup label="Benchmark">
                        <SelectInput
                            options={['S&P 500', 'Nasdaq 100', 'Total World']}
                            onChange={(val) => handleChange('benchmark', val)}
                        />
                    </InputGroup>
                    <ToggleSwitch
                        label="Show Real-time Drift"
                        onChange={(val) => handleChange('show_drift', val)}
                    />
                </>
            );

        default:
            return <div className="text-gray-500">Select a tool to configure inputs.</div>;
    }
};

export default WizardInputs;
