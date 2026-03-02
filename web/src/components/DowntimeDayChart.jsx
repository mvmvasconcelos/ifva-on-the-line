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

export function DowntimeDayChart({ history }) {
    const daysOfWeek = [
        'Domingo', 'Segunda', 'Terça', 'Quarta',
        'Quinta', 'Sexta', 'Sábado'
    ];

    const daysCount = {
        'Domingo': 0, 'Segunda': 0, 'Terça': 0,
        'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0
    };

    history.forEach(event => {
        const d = new Date(event.timestamp);
        const dayName = daysOfWeek[d.getDay()];
        daysCount[dayName]++;
    });

    const data = {
        labels: daysOfWeek.map(d => d.substring(0, 3)),
        datasets: [
            {
                label: 'Quedas por Dia',
                data: Object.values(daysCount),
                backgroundColor: 'rgba(234, 179, 8, 0.5)',
                borderColor: 'rgb(234, 179, 8)',
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
                text: 'Quedas por Dia da Semana',
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1,
                    precision: 0
                }
            }
        }
    };

    return <Bar options={options} data={data} />;
}
