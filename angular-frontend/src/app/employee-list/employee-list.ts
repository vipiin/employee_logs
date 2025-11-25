import { Component } from '@angular/core';
import { Employee } from '../employee';
import { CommonModule } from '@angular/common';
import { EmployeeService } from '../employee-service';
import { Route, Router } from '@angular/router';
@Component({
  selector: 'app-employee-list',
  imports: [],
  templateUrl: './employee-list.html',
  styleUrl: './employee-list.css',
})
export class EmployeeList {
  employees!: Employee[];
  constructor(private employeeService: EmployeeService,private router:Router){}
  ngOnInit(): void {
    this.getEmployees();
  }
  private getEmployees() {
    this.employeeService.getEmployeesList().subscribe(data=>{
      this.employees=data;
    })
  }
  updateEmployee(id:number){
    this.router.navigate(['update-employee', id]) 
  }
  deleteEmployee(id:number){
    this.employeeService.deleteEmployee(id).subscribe(data=>{
      console.log(data);
      this.getEmployees();
    });
  }
  employeeDetails(id:number){
    this.router.navigate(['employee-details',id]);
  }
}
