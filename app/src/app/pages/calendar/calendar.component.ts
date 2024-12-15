import { NzAlertModule } from "ng-zorro-antd/alert";
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { NzCalendarModule } from "ng-zorro-antd/calendar";
import { NzGridModule } from "ng-zorro-antd/grid";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { Subscription } from "rxjs";

import { CommonModule, DOCUMENT } from "@angular/common";
import {
    Component,
    HostListener,
    inject,
    OnDestroy,
    OnInit,
} from "@angular/core";
import {
    and,
    collection,
    Firestore,
    getDocs,
    query,
    QueryFilterConstraint,
    where,
} from "@angular/fire/firestore";
import { FormsModule } from "@angular/forms";

import { AuthService } from "../../services/auth.service";
import { IEvent } from "../../types";

@Component({
    selector: "app-calendar",
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        NzAlertModule,
        NzBadgeModule,
        NzCalendarModule,
        NzGridModule,
        NzIconModule,
        NzSpinModule,
    ],
    templateUrl: "./calendar.component.html",
    styleUrl: "./calendar.component.less",
})
export class CalendarComponent implements OnInit, OnDestroy {
    public firestore = inject(Firestore);
    private document = inject(DOCUMENT);

    selectedDate: Date = new Date();

    eventCollectionRef = collection(this.firestore, "events");

    showLoading = false;
    events: { [key: string]: IEvent[] } = {};

    authStateSubscription!: Subscription;

    width: string = "700px";
    isSmallScreen: boolean = false;
    @HostListener("window:resize")
    resize(): void {
        const clientWidth = this.document.body.clientWidth;
        this.width = clientWidth < 700 ? "100vw" : "700px";
        this.isSmallScreen = clientWidth < 1240;
    }

    constructor(public auth: AuthService) {}

    async ngOnInit() {
        this.resize();
        this.authStateSubscription = this.auth.authState$.subscribe(() => {
            this.runQuery();
        });
    }

    runQuery() {
        this.showLoading = true;

        // Gets anything after 14th of last month, and before 14th of next month
        const queryList: QueryFilterConstraint[] = [
            where(
                "startDatetime",
                ">=",
                new Date(
                    this.selectedDate.getFullYear(),
                    this.selectedDate.getMonth(),
                    -14
                )
            ),
            where(
                "startDatetime",
                "<=",
                new Date(
                    this.selectedDate.getFullYear(),
                    this.selectedDate.getMonth() + 1,
                    14
                )
            ),
            where("isApproved", "==", true),
        ];

        getDocs(query(this.eventCollectionRef, and(...queryList)))
            .then((data) => {
                data.forEach((event) => {
                    const eventData = event.data() as IEvent;
                    const dateString = eventData.startDatetime
                        .toDate()
                        .toISOString()
                        .split("T")[0];
                    const eventDateObj = this.events[dateString];
                    if (eventDateObj) {
                        eventDateObj.push(eventData);
                    } else {
                        this.events[dateString] = [eventData];
                    }
                });
                console.log(this.events);
                this.showLoading = false;
            })
            .catch((err) => {
                console.error(err);
            });
    }
    selectChange(event: any) {}

    ngOnDestroy(): void {
        this.authStateSubscription?.unsubscribe();
    }
}
