import { NzButtonModule } from "ng-zorro-antd/button";
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import {
    NzDrawerModule,
    NzDrawerRef,
    NzDrawerService,
} from "ng-zorro-antd/drawer";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { NzFlexModule } from "ng-zorro-antd/flex";
import { NzGridModule } from "ng-zorro-antd/grid";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzSegmentedModule, NzSegmentedOption } from "ng-zorro-antd/segmented";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { NzSwitchModule } from "ng-zorro-antd/switch";
import { Subscription } from "rxjs";

import { CommonModule, DOCUMENT } from "@angular/common";
import {
    Component,
    HostListener,
    inject,
    Input,
    OnDestroy,
    OnInit,
    TemplateRef,
    ViewChild,
} from "@angular/core";
import {
    and,
    collection,
    doc,
    Firestore,
    getDocs,
    or,
    orderBy,
    query,
    QueryFilterConstraint,
    where,
} from "@angular/fire/firestore";
import { FormGroup, FormsModule } from "@angular/forms";
import { Router } from "@angular/router";

import { FormProps } from "../../form-classes";
import { AuthService } from "../../services/auth.service";
import { NotificationService } from "../../services/notification.service";
import { IEvent } from "../../types";
import { EventCardComponent } from "../../ui/event-card/event-card.component";
import { EventFormComponent } from "../../ui/event-form/event-form.component";
import { SearchComponent } from "../../ui/search/search.component";

type DrawerReturnData = any;

const segmentOptions: NzSegmentedOption[] = [
    {
        label: "Past Events",
        value: "past",
        icon: "history",
    },
    {
        label: "Upcoming Events",
        value: "upcoming",
        icon: "calendar",
    },
];

@Component({
    selector: "app-events",
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        EventCardComponent,
        SearchComponent,
        NzButtonModule,
        NzCollapseModule,
        NzDrawerModule,
        NzEmptyModule,
        NzFlexModule,
        NzGridModule,
        NzIconModule,
        NzSegmentedModule,
        NzSpinModule,
        NzSwitchModule,
    ],
    templateUrl: "./events.component.html",
    styleUrl: "./events.component.less",
})
export class EventsComponent implements OnInit, OnDestroy {
    private firestore = inject(Firestore);
    private document = inject(DOCUMENT);

    events: IEvent[] = [];
    oriEvents: IEvent[] = [];

    currInputText = "";
    showUnapprovedOnly = false;

    isLoading: boolean = true;
    eventCollectionRef = collection(this.firestore, "events");
    isSmallScreen: boolean = false;

    authStateSubscription!: Subscription;

    drawerRef: NzDrawerRef<EventFormComponent, DrawerReturnData> | undefined =
        undefined;
    @ViewChild("drawerFooter") drawerFooter!: TemplateRef<any>;

    width: string = "700px";
    @HostListener("window:resize")
    resize(): void {
        const clientWidth = this.document.body.clientWidth;
        this.width = clientWidth < 700 ? "100vw" : "700px";
        this.isSmallScreen = clientWidth < 1240;

        this.displaySegmentOptions = segmentOptions.map((elem) => {
            return {
                ...(elem as any),
                label: this.isSmallScreen ? undefined : elem.label,
            };
        });
    }

    constructor(
        private drawerService: NzDrawerService,
        private notification: NotificationService,
        public auth: AuthService,
        private router: Router
    ) {}

    runQuery() {
        this.isLoading = true;

        const showFuture =
            segmentOptions[this.segmentSelection].value === "upcoming";
        const queryList: QueryFilterConstraint[] = [
            where("endDatetime", showFuture ? ">=" : "<=", new Date()),
        ];

        if (!this.auth.isLoggedIn()) {
            queryList.push(where("isApproved", "==", true));
        } else {
            if (!this.auth.isAdmin()) {
                /**
                 * If show all:
                 * isApproved = true +
                 * isApproved = false , author = me
                 *
                 * If show unapproved only:
                 * isApproved = false , author = me
                 */
                const orClause = [];

                if (!this.showUnapprovedOnly) {
                    orClause.push(where("isApproved", "==", true));
                }
                orClause.push(
                    and(
                        where("isApproved", "==", false),
                        where(
                            "authorId",
                            "==",
                            doc(
                                this.firestore,
                                "users",
                                `${this.auth.userData.value?.uid}`
                            )
                        )
                    )
                );

                queryList.push(or(...orClause));
            } else {
                if (this.showUnapprovedOnly) {
                    queryList.push(where("isApproved", "==", false));
                }
            }
        }

        const queryRef = query(
            this.eventCollectionRef,
            and(...queryList),
            orderBy("startDatetime", showFuture ? "asc" : "desc")
        );
        getDocs(queryRef)
            .then((data) => {
                const currArray: IEvent[] = [];
                data.forEach((elem) => {
                    currArray.push({ ...(elem.data() as IEvent), id: elem.id });
                });
                this.oriEvents = currArray;
                if (this.currInputText) {
                    this.filterEvents(this.currInputText);
                } else {
                    this.events = [...this.oriEvents];
                }
                this.isLoading = false;
            })
            .catch((err) => {
                console.error(err);
            });
    }

    @Input()
    set state(state: string) {
        this.onSegmentChange(
            segmentOptions.findIndex((val: NzSegmentedOption) => {
                return val.value === state;
            })
        );
    }
    @Input()
    set page(page: number) {}

    ngOnInit(): void {
        this.resize();
        this.authStateSubscription = this.auth.authState$.subscribe(() => {
            this.runQuery();
        });
    }

    ngOnDestroy(): void {
        this.authStateSubscription?.unsubscribe();
    }

    onShowUnapprovedChange(showUnapprovedOnly: boolean) {
        this.showUnapprovedOnly = showUnapprovedOnly;
        this.runQuery();
    }

    displaySegmentOptions = { ...segmentOptions };
    segmentSelection: number = 1;
    onSegmentChange(index: number) {
        if (index < 0) {
            return;
        }

        this.router
            .navigate(["events", segmentOptions[index].value, 1], {
                queryParamsHandling: "preserve",
            })
            .then(() => {
                this.segmentSelection = index;
                this.runQuery();
            });
    }

    filterEvents(inputText: string) {
        if (inputText === "") {
            this.events = [...this.oriEvents];
            return;
        }

        const caseInsensitiveLowerCase = inputText.toLowerCase();
        this.events = this.oriEvents.filter((data) => {
            // console.log(
            //     caseInsensitiveLowerCase,
            //     data.title,
            //     data.title.toLowerCase().indexOf(caseInsensitiveLowerCase),
            //     data.subtitle,
            //     data.subtitle
            //         ?.toLowerCase()
            //         .indexOf(caseInsensitiveLowerCase) ?? false
            // );
            return (
                data.title.toLowerCase().indexOf(caseInsensitiveLowerCase) >
                    -1 ||
                (data.subtitle
                    ?.toLowerCase()
                    .indexOf(caseInsensitiveLowerCase) ?? -1) > -1
            );
        });

        this.currInputText = inputText;
    }

    openDrawer() {
        this.drawerRef = this.drawerService.create<
            EventFormComponent,
            { [key: string]: any },
            string
        >({
            nzTitle: "Add Event Entry",
            nzFooter: this.drawerFooter,
            // nzExtra: "Extra",
            nzWidth: this.width,
            nzContent: EventFormComponent,
            nzData: {
                targetCollection: "events",
                formProps: [
                    new FormProps("Title", "title", {
                        required: true,
                    }),
                    new FormProps("Subtitle", "subtitle", {
                        required: false,
                        default: "undefined",
                    }),
                    new FormProps("Description", "description", {
                        fieldType: "markdown",
                        required: true,
                        tooltip: "You can use markdown here 😎",
                    }),
                    new FormProps("Start Datetime", "startDatetime", {
                        fieldType: "datetime",
                        required: true,
                        default: "undefined",
                    }),
                    new FormProps("End Datetime", "endDatetime", {
                        fieldType: "datetime",
                        required: true,
                        default: "undefined",
                    }),
                    new FormProps("Event Links", "eventLinks", {
                        fieldType: "paragraphText",
                        required: true,
                        helpText: "Related links, one per row",
                    }),
                    new FormProps("Organizers", "organizerIds", {
                        firestore: this.firestore,
                        fieldType: "multiSelect",
                        collection: "organizers",
                        labelField: "name",
                    }),
                    new FormProps("Event Banner Url", "bannerUri", {
                        default: "undefined",
                    }),
                    // new FormProps("", "locationId"),
                    // new FormProps("", "tagIds", {
                    //     default: [],
                    // }),
                    new FormProps("Is Paid Event", "isPaid", {
                        fieldType: "checkbox",
                    }),
                    new FormProps("Walk-In Available", "isWalkInAvailable", {
                        fieldType: "checkbox",
                        default: true,
                    }),
                    new FormProps("Details Confirmed", "isConfirmed", {
                        fieldType: "checkbox",
                    }),
                    new FormProps("Is Approved", "isApproved", {
                        fieldType: "checkbox",
                        display: this.auth.isAdmin(),
                        default: false,
                    }),
                    new FormProps("", "createdAt", { display: false }),
                    new FormProps("", "updatedAt", { display: false }),
                ],
                submissionModifier: (data: any) => {
                    data.eventLinks = (data.eventLinks as string)
                        .trim()
                        .split("\n");
                    data.authorId = doc(
                        this.firestore,
                        "users",
                        `${this.auth.userData.value?.uid}`
                    );
                    data.organizerIds = data.organizerIds
                        ? data.organizerIds.map((id: string) => {
                              return doc(this.firestore, "organizers", id);
                          })
                        : [];
                    data.createdAt = new Date();
                    data.updatedAt = new Date();
                    return data;
                },
                onInputChange: (
                    controlName: string,
                    data: any,
                    rootForm: FormGroup<any>
                ) => {
                    switch (controlName) {
                        case "startDatetime": {
                            console.log(data);
                            rootForm.patchValue({ endDatetime: data });
                        }
                    }
                },
            },
        });

        this.drawerRef.afterOpen.subscribe(() => {
            console.log("Drawer(Component) open");
        });

        this.drawerRef.afterClose.subscribe((data) => {
            console.log(data);
        });
    }

    close() {
        this.drawerRef?.close();
    }

    submit() {
        const drawerRef = this.drawerRef;
        if (!drawerRef) return;

        const contentComponent = drawerRef.getContentComponent();
        if (!contentComponent) return;

        contentComponent.showLoading = true;
        contentComponent
            .onSubmit()
            ?.then((res) => {
                contentComponent.showLoading = false;
                this.notification.success(
                    "Success",
                    "Event added successfully."
                );
                drawerRef.close();
            })
            .catch((reason: any) => {
                this.notification.error("Unknown Error", reason.message);
                contentComponent.showLoading = false;
            });
    }
}
