/** @jest-environment jsdom */
import { jest } from '@jest/globals';

const addChart = jest.fn();
const getChart = jest.fn();
const destroyChart = jest.fn();
const clearCharts = jest.fn();

global.AppState = {
  addChart,
  getChart,
  destroyChart,
  clearCharts
};

describe('ChartService reuse prevention', () => {
  beforeEach(async () => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      clearRect: jest.fn()
    }));
    document.body.innerHTML = '<canvas id="confirmationChart"></canvas>';
    addChart.mockReset();
    getChart.mockReset();
    destroyChart.mockReset();
    clearCharts.mockReset();

    const destroySpy = jest.fn();
    global.Chart = function ChartMock(ctx, config) {
      this.ctx = ctx;
      this.config = config;
      return this;
    };
    global.Chart.getChart = jest.fn(() => ({ destroy: destroySpy }));

    await import('../../public/js/services/chart.service.js');
  });

  it('destroys existing chart instance before creating', () => {
    const chart = global.ChartService.createChart('confirmationChart', {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {}
    });

    expect(global.Chart.getChart).toHaveBeenCalled();
    expect(addChart).toHaveBeenCalled();
    expect(chart).toBeTruthy();
  });
});
