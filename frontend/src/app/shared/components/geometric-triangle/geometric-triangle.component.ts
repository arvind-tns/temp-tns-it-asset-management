/**
 * Geometric Triangle Component - Editorial Geometry Accent System
 * 
 * Renders geometric triangle accents that break the grid and act as
 * visual anchors following Editorial Geometry design principles.
 */

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type TriangleSize = 'small' | 'medium' | 'large';
export type TrianglePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

@Component({
  selector: 'app-geometric-triangle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="triangle-container"
      [class]="positionClass"
      [style.width.px]="triangleWidth"
      [style.height.px]="triangleHeight">
      <svg 
        [attr.width]="triangleWidth" 
        [attr.height]="triangleHeight" 
        [attr.viewBox]="viewBox" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        class="triangle-svg">
        <path 
          [attr.d]="trianglePath" 
          [attr.fill]="color" 
          [attr.opacity]="opacity"/>
      </svg>
    </div>
  `,
  styles: [`
    .triangle-container {
      position: absolute;
      z-index: -1;
      pointer-events: none;
    }
    
    .triangle-svg {
      display: block;
    }
    
    /* Position Classes */
    .position-top-left {
      top: 0;
      left: 0;
    }
    
    .position-top-right {
      top: 0;
      right: 0;
    }
    
    .position-bottom-left {
      bottom: 0;
      left: 0;
    }
    
    .position-bottom-right {
      bottom: 0;
      right: 0;
    }
    
    .position-center {
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
    
    /* Breathing Room - Minimum 80px space around geometric accents */
    .triangle-container {
      margin: var(--editorial-triangle-breathing-room, 80px);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GeometricTriangleComponent {
  @Input() size: TriangleSize = 'medium';
  @Input() position: TrianglePosition = 'top-right';
  @Input() color: string = 'var(--color-primary-blue-800, #143b7d)';
  @Input() opacity: number = 0.1;
  @Input() blur: boolean = false;

  get triangleWidth(): number {
    switch (this.size) {
      case 'small': return 80;
      case 'medium': return 120;
      case 'large': return 200;
      default: return 120;
    }
  }

  get triangleHeight(): number {
    switch (this.size) {
      case 'small': return 69;
      case 'medium': return 104;
      case 'large': return 173;
      default: return 104;
    }
  }

  get viewBox(): string {
    return `0 0 ${this.triangleWidth} ${this.triangleHeight}`;
  }

  get trianglePath(): string {
    const width = this.triangleWidth;
    const height = this.triangleHeight;
    const halfWidth = width / 2;
    
    // Equilateral triangle pointing upward
    return `M${halfWidth} 0L${width - 0.358979 * width} ${height}H${0.358979 * width}L${halfWidth} 0Z`;
  }

  get positionClass(): string {
    return `position-${this.position}`;
  }
}