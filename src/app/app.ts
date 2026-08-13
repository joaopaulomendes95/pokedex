import { Component } from '@angular/core';
import { Navbar } from '@layout/navbar/navbar';
import { PokeHub } from '@poke/features/poke-hub/poke-hub';

@Component({
  selector: 'app-root',
  imports: [Navbar, PokeHub],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class App {}
