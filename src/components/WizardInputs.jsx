import React, { useState } from 'react';
import { Info, Plus, Trash2, Check } from 'lucide-react';

// --- Helper Components ---

const InputGroup = ({ label, children, tooltip }) => (
    <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">{label}</label>
            {/* MODIFIED: Added proper title attribute for tooltip display */}
            {tooltip && <div title={tooltip}><Info size={14} className="text-gray-500 hover:text-gold cursor-help" /></div>}
        </div>
        {children}
    </div>
);

const TextInput = ({ placeholder, defaultValue, value, onChange }) => (
    <input
        type="text"
        defaultValue={defaultValue}
        value={value}
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

const CheckboxInput = ({ label, onChange, checked: controlledChecked, disabled }) => {
    const [internalChecked, setInternalChecked] = useState(false);

    // Allow controlled or uncontrolled mode
    const isControlled = controlledChecked !== undefined;
    const checked = isControlled ? controlledChecked : internalChecked;

    const handleCheck = () => {
        if (disabled) return;
        const newState = !checked;
        if (!isControlled) setInternalChecked(newState);
        if (onChange) onChange(newState);
    };

    return (
        <div
            className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${disabled ? 'bg-gray-800/50 border-gray-800 cursor-not-allowed opacity-60' : 'bg-white/5 border-gray-800 cursor-pointer hover:bg-white/10'}`}
            onClick={handleCheck}
        >
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${checked ? (disabled ? 'bg-gray-600 border-gray-600' : 'bg-gold border-gold') : 'border-gray-600 bg-transparent'}`}>
                {checked && <Check size={14} className="text-black" strokeWidth={3} />}
            </div>
            <span className="text-sm text-gray-300 select-none">{label} {disabled && "(Locked)"}</span>
        </div>
    );
};

const ToggleSwitch = ({ label, onChange }) => {
    const [active, setActive] = useState(false);
    return (
        <div className="flex items-center justify-between p-4 bg-black/50 rounded-lg border border-gray-800 cursor-pointer" onClick={() => {
            const newState = !active;
            setActive(newState);
            if (onChange) onChange(newState);
        }}>
            <span className="text-sm text-gray-300">{label}</span>
            <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${active ? 'bg-gold' : 'bg-gray-700'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${active ? 'left-7' : 'left-1'}`} />
            </div>
        </div>
    );
};

const SubPortfolioInput = ({ subPortfolios, onChange }) => {
    const addPortfolio = () => {
        const newPortfolios = [...subPortfolios, { tickers: '', weight: 0 }];
        onChange(newPortfolios);
    };

    const removePortfolio = (index) => {
        const newPortfolios = subPortfolios.filter((_, i) => i !== index);
        onChange(newPortfolios);
    };

    const updatePortfolio = (index, field, value) => {
        const newPortfolios = [...subPortfolios];
        newPortfolios[index] = { ...newPortfolios[index], [field]: value };
        onChange(newPortfolios);
    };

    return (
        <div className="space-y-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {subPortfolios.map((portfolio, index) => (
                <div key={index} className="p-4 border border-gray-800 rounded-lg bg-white/5 relative">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gold uppercase">Sub-Portfolio {index + 1}</span>
                        {subPortfolios.length > 1 && (
                            <button onClick={() => removePortfolio(index)} className="text-gray-500 hover:text-red-500">
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Tickers (Comma separated)</label>
                            <TextInput
                                value={portfolio.tickers}
                                placeholder="AAPL, MSFT"
                                onChange={(val) => updatePortfolio(index, 'tickers', val)}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block">Weight (%)</label>
                            <TextInput
                                value={portfolio.weight}
                                placeholder="50"
                                onChange={(val) => updatePortfolio(index, 'weight', val)}
                            />
                        </div>
                    </div>
                </div>
            ))}
            <button
                onClick={addPortfolio}
                className="w-full py-2 border border-gray-700 border-dashed rounded-lg text-gray-400 hover:text-white hover:border-gray-500 hover:bg-white/5 transition-all flex items-center justify-center gap-2 text-sm"
            >
                <Plus size={16} /> Add Another Sub-Portfolio
            </button>
        </div>
    );
};

// --- Exported Modal Component ---

export const PortfolioConfigForm = ({ onChange }) => {
    const [subPortfolios, setSubPortfolios] = useState([{ tickers: '', weight: 100 }]);

    const handleSubPortfolioChange = (newPortfolios) => {
        setSubPortfolios(newPortfolios);
        onChange('sub_portfolios', newPortfolios);
    };

    return (
        <div>
            <InputGroup label="EMA Sensitivity">
                <SelectInput
                    options={['Low (Long-term)', 'Medium (Swing)', 'High (Day Trade)']}
                    onChange={(val) => onChange('sensitivity', val)}
                />
            </InputGroup>
            {/* MODIFIED: Added Tooltip */}
            <InputGroup label="Amplification Factor" tooltip="Amplification signifies how much to 'amplify' the weight that stocks with more momentum get in the portfolio.">
                <SliderInput
                    min={0.25} max={3} defaultValue={1.5} unit="x" step={0.25}
                    onChange={(val) => onChange('amplification', val)}
                />
            </InputGroup>
            <InputGroup label="Sub-portfolios (Tickers)" tooltip="Define tickers and weights for your new strategy.">
                <SubPortfolioInput
                    subPortfolios={subPortfolios}
                    onChange={handleSubPortfolioChange}
                />
            </InputGroup>
        </div>
    );
};

// --- Main WizardInputs Component ---

const WizardInputs = ({ toolType, onChange, values }) => {
    const [subPortfolios, setSubPortfolios] = useState([{ tickers: '', weight: 100 }]);

    const handleSubPortfolioChange = (newPortfolios) => {
        setSubPortfolios(newPortfolios);
        onChange('sub_portfolios', newPortfolios);
    };

    const handleChange = (field, value) => {
        onChange(field, value);
    };

    const renderBasicInputs = (placeholder) => (
        <>
            <InputGroup label="Portfolio Code Name">
                <TextInput
                    placeholder={placeholder}
                    onChange={(val) => handleChange('name', val)}
                />
            </InputGroup>
            <InputGroup label="Portfolio Value ($)">
                <TextInput
                    placeholder={values?.execute_rh ? "Auto (Uses RH Equity)" : "Enter Value"}
                    onChange={(val) => handleChange('capital', val === '' ? 0 : parseFloat(val))}
                />
            </InputGroup>
            <div className="mt-4">
                <CheckboxInput
                    label="Use Fractional Shares"
                    onChange={(val) => handleChange('use_fractional_shares', val)}
                />
            </div>
        </>
    );

    switch (toolType) {
        case 'custom':
            return renderBasicInputs("e.g., MY_STRATEGY_V1");

        case 'tracking':
            return (
                <>
                    {renderBasicInputs("e.g., EXISTING_PORTFOLIO")}
                    <div className="mt-6 pt-6 border-t border-gray-800">
                        <h3 className="text-gold font-bold mb-4 text-sm uppercase tracking-wide">Execution Options</h3>

                        <div className="space-y-4">
                            {/* Email Options */}
                            <div className="p-4 rounded-lg border border-gray-800 bg-white/5">
                                <div className="mb-2">
                                    <CheckboxInput
                                        label="Send Trades to Email"
                                        onChange={(val) => handleChange('send_email', val)}
                                        checked={values?.send_email}
                                    />
                                </div>
                                <TextInput
                                    placeholder="Enter your email address"
                                    onChange={(val) => handleChange('email_to', val)}
                                    value={values?.email_to || ""}
                                />
                            </div>

                            {/* Robinhood Options */}
                            <div className="p-4 rounded-lg border border-gray-800 bg-white/5">
                                <div className="mb-2">
                                    <CheckboxInput
                                        label="Execute on Robinhood"
                                        onChange={(val) => handleChange('execute_rh', val)}
                                        checked={values?.execute_rh}
                                    />
                                </div>
                                <div className="space-y-3 mt-3">
                                    <TextInput
                                        placeholder="Robinhood Username"
                                        onChange={(val) => handleChange('rh_user', val)}
                                        value={values?.rh_user || ""}
                                    />
                                    {/* Password Input manually since TextInput has no type prop */}
                                    <input
                                        type="password"
                                        placeholder="Robinhood Password"
                                        onChange={(e) => handleChange('rh_pass', e.target.value)}
                                        value={values?.rh_pass || ""}
                                        className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-white focus:border-royal-purple focus:ring-1 focus:ring-royal-purple outline-none transition-all duration-300 placeholder-gray-600"
                                    />
                                    <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded text-xs text-yellow-200/80">
                                        Important: If you have 2FA enabled, please check your mobile device immediately after executing.
                                    </div>
                                </div>
                            </div>

                            {/* Overwrite Option */}
                            <CheckboxInput
                                label="Overwrite last save file?"
                                onChange={(val) => handleChange('overwrite', val)}
                                checked={values?.overwrite}
                                disabled={values?.execute_rh}
                            />
                        </div>
                    </div>
                </>
            );

        case 'invest':
            return (
                <>
                    <InputGroup label="Portfolio Construction" tooltip="Define your sub-portfolios and their weights.">
                        <SubPortfolioInput
                            subPortfolios={subPortfolios}
                            onChange={handleSubPortfolioChange}
                        />
                    </InputGroup>

                    <InputGroup label="Investment Capital ($)" tooltip="Total amount you wish to allocate.">
                        <TextInput
                            placeholder="Enter Value"
                            onChange={(val) => handleChange('capital', val === '' ? 0 : parseFloat(val))}
                        />
                    </InputGroup>
                    <InputGroup label="EMA Sensitivity">
                        <SelectInput
                            options={['Low (Long-term)', 'Medium (Swing)', 'High (Day Trade)']}
                            onChange={(val) => handleChange('sensitivity', val)}
                        />
                    </InputGroup>
                    {/* MODIFIED: Added Tooltip */}
                    <InputGroup label="Amplification" tooltip="Amplification signifies how much to 'amplify' the weight that stocks with more momentum get in the portfolio.">
                        <SliderInput
                            min={0.25} max={5} defaultValue={1} unit="x" step={0.25}
                            onChange={(val) => handleChange('amplification', val)}
                        />
                    </InputGroup>

                    <div className="mt-4">
                        <CheckboxInput
                            label="Use Fractional Shares"
                            onChange={(val) => handleChange('use_fractional_shares', val)}
                        />
                    </div>
                </>
            );

        case 'cultivate':
            return (
                <>
                    <InputGroup label="Strategy Code">
                        <SelectInput
                            options={['Code A (Market)', 'Code B (SPY)']}
                            onChange={(val) => handleChange('strategy_code', val)}
                        />
                    </InputGroup>
                    <InputGroup label="Total Portfolio Value ($)">
                        <TextInput
                            placeholder="Enter Value"
                            onChange={(val) => handleChange('capital', val === '' ? 0 : parseFloat(val))}
                        />
                    </InputGroup>
                    <div className="mt-4">
                        <CheckboxInput
                            label="Use Fractional Shares"
                            onChange={(val) => handleChange('use_fractional_shares', val)}
                        />
                    </div>
                </>
            );

        case 'tracking_simple':
            return renderBasicInputs("e.g., EXISTING_PORTFOLIO");

        default:
            return <div className="text-gray-500">Select a tool to configure inputs.</div>;
    }
};

export default WizardInputs;