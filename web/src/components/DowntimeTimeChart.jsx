import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export function DowntimeTimeChart({ history }) {
    const timeBlocks = {
        'Madrugada (00-06)': 0,
        'Manhã (06-12)': 0,
        'Tarde (12-18)': 0,
        'Noite (18-24)': 0
    };

    history.forEach(event => {
        const d = new Date(event.timestamp);
        const hour = d.getHours();

        if (hour >= 0 && hour < 6) timeBlocks['Madrugada (00-06)']++;
        else if (hour >= 6 && hour < 12) timeBlocks['Manhã (06-12)']++;
        else if (hour >= 12 && hour < 18) timeBlocks['Tarde (12-18)']++;
        else timeBlocks['Noite (18-24)']++;
    });

    const data = {
        labels: Object.keys(timeBlocks),
        datasets: [
            {
                label: 'Quedas por Turno',
                data: Object.values(timeBlocks),
                backgroundColor: 'rgba(99, 102, 241, 0.5)',
                borderColor: 'rgb(99, 102, 241)',
                borderWidth: 1,
                borderRadius: 4,
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: true,
                text: 'Quedas por Turno do Dia',
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                stepSize: 1,
            }
        }
    };

    return <Bar options={options} data={data} />;
}
