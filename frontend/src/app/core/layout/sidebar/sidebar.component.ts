/**
 * SidebarComponent - Editorial Geometry Navigation Panel
 * 
 * Implements the fixed left navigation panel with brand identity,
 * primary navigation, and geometric triangle accents following
 * Editorial Geometry design principles.
 * 
 * Requirements: 2.1, 2.2, 2.6, 2.7, 16.2, 21.6, 24.2
 */

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  
  /**
   * Current route observable for active state detection
   */
  @Input() currentRoute$!: Observable<string>;
  
  constructor() {}
}