import { useState } from 'react';

export default function TimeSelector() {
    const [day, setDay] = useState('');
    const [hour, setHour] = useState('12');
    const [minute, setMinute] = useState('00');
    const [period, setPeriod] = useState('AM');

    // Generate hour options (1-12)
    const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

    // Generate minute options (00, 15, 30, 45)
    const minutes = ['00', '15', '30', '45'];

    // Days of the week
    const days = [];
    // gets current day, date, time 
    
    const today = new Date();
    const options = { month: 'short', day: '2-digit' }; // e.g., "May 01"
    
    for (let i = 0; i < 8; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const formatted = date.toLocaleDateString('en-US', options);
      days.push(formatted)
      
    }


    return (
        <div className="p-4 bg-gray-50 rounded-md shadow-sm max-w-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Time Selector</h2>

            <div className="mb-4">
                <label className="block text-gray-700 mb-2" htmlFor="day-select">Day:</label>
                <select
                    id="day-select"
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={day}
                    onChange={(e) => {
                        const selectedDay = e.target.value;
                        setDay(selectedDay);
                        console.log('Selected day:', selectedDay);
                    }}
                >
                    <option value="">Select a day</option>
                    {days.map((d) => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-gray-700 mb-2">Time:</label>
                <div className="flex items-center space-x-2">
                    <select
                        className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={hour}
                        onChange={(e) => {
                            const selectedHour = e.target.value
                            setHour(selectedHour);
                            console.log("Selected Hour: ", selectedHour)

                        }}
                    >
                        {hours.map((h) => (
                            <option key={h} value={h}>{h}</option>
                        ))}
                    </select>

                    <span className="text-gray-700">:</span>

                    <select
                        className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={minute}
                        onChange={(e) => {
                            const selectedMinute = e.target.value
                            setMinute(selectedMinute)
                            console.log("Selected Minute", selectedMinute)

                        }}
                    >
                        {minutes.map((m) => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>

                    <select
                        className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        value={period}
                        onChange={(e) => {
                            const selectedPeriod = e.target.value
                            setPeriod(selectedPeriod)
                            console.log("Selected Period: ", selectedPeriod)

                        }}
                    >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                    </select>
                </div>
            </div>
        </div>
    );
}