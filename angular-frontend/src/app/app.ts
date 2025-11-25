import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLinkWithHref, RouterLinkActive } from '@angular/router';
import { EmployeeList } from './employee-list/employee-list';
import { CreateEmployee } from './create-employee/create-employee';
import { UpdateEmployee } from './update-employee/update-employee';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, EmployeeList, RouterLinkWithHref, RouterLinkActive,CreateEmployee,UpdateEmployee],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('COMPANY-ABC');
}
