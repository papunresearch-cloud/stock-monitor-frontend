import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Component', () => {
  it('renders without crashing', () => {
    // This orchestrates the test by rendering the App component in an invisible browser
    render(<App />);
    
    // We are just checking if the code runs successfully without throwing an error
    expect(true).toBe(true);
  });
});