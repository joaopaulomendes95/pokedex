import { describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { CustomSpinner } from '@shared/ui/custom-spinner/custom-spinner';

describe('CustomSpinner', () => {
  let fixture: ComponentFixture<CustomSpinner>;

  it('renders the three bouncer balls', async () => {
    await TestBed.configureTestingModule({
      imports: [CustomSpinner],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomSpinner);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.bouncer-wrapper').length).toBe(3);
    expect(host.querySelectorAll('.bouncer').length).toBe(3);
    expect(host.querySelector('.custom-spinner-wrapper')).not.toBeNull();
  });
});
