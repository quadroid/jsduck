/**
 * Toolbar with menus providing quick access to class members.
 */
Ext.define('Docs.view.cls.Toolbar', {
    extend: 'Ext.toolbar.Toolbar',
    requires: [
        'Docs.view.HoverMenuButton',
        'Docs.Settings'
    ],

    dock: 'top',
    cls: 'member-links',
    padding: '3 5',

    /**
     * @cfg {Object} docClass
     * Documentation for a class.
     */
    docClass: {},

    initComponent: function() {
        this.items = [];
        this.memberButtons = {};

        var memberTitles = {
            cfg: "Configs",
            property: "Properties",
            method: "Methods",
            event: "Events"
        };
        for (var type in memberTitles) {
            var members = this.docClass.members[type];
            var statics = this.docClass.statics[type];
            if (members.length || statics.length) {
                var btn = this.createMemberButton({
                    text: memberTitles[type],
                    type: type,
                    members: members.concat(statics)
                });
                this.memberButtons[type] = btn;
                this.items.push(btn);
            }
        }

        if (this.docClass.subclasses.length) {
            this.items.push(this.createClassListButton("Sub Classes", this.docClass.subclasses));
        }
        if (this.docClass.mixedInto.length) {
            this.items.push(this.createClassListButton("Mixed Into", this.docClass.mixedInto));
        }

        this.items = this.items.concat([
            { width: 10 },
            {
                xtype: 'textfield',
                emptyText: 'Find class members...',
                enableKeyEvents: true,
                listeners: {
                    keyup: function(cmp) {
                        this.filterMembers(cmp.getValue());
                    },
                    specialkey: function(cmp, event) {
                        if (event.keyCode === Ext.EventObject.ESC) {
                            cmp.reset();
                            this.filterMembers("");
                        }
                    },
                    scope: this
                }
            },
            { xtype: 'tbfill' },
            {
                boxLabel: 'Hide inherited',
                boxLabelAlign: 'before',
                xtype: 'checkbox',
                margin: '0 5 0 0',
                padding: '0 0 5 0',
                checked: Docs.Settings.get("hideInherited"),
                handler: function(el) {
                    this.hideInherited(el.checked);
                },
                scope: this
            },
            {
                xtype: 'button',
                iconCls: 'expandAllMembers',
                tooltip: "Expand all",
                handler: function() {
                    Ext.Array.forEach(Ext.query('.side.expandable'), function(el) {
                        Ext.get(el).parent().addCls('open');
                    });
                }
            },
            {
                xtype: 'button',
                iconCls: 'collapseAllMembers',
                tooltip: "Collapse all",
                handler: function() {
                    Ext.Array.forEach(Ext.query('.side.expandable'), function(el) {
                        Ext.get(el).parent().removeCls('open');
                    });
                }
            }
        ]);

        this.callParent(arguments);
    },

    createMemberButton: function(cfg) {
        var data = Ext.Array.map(cfg.members, function(m) {
            return this.createLinkRecord(this.docClass.name, m);
        }, this);

        return Ext.create('Docs.view.HoverMenuButton', {
            text: cfg.text,
            cls: 'icon-'+cfg.type,
            store: this.createStore(data),
            showCount: true,
            listeners: {
                click: function() {
                    this.up('classoverview').scrollToEl("#m-" + cfg.type);
                },
                scope: this
            }
        });
    },

    createClassListButton: function(text, classes) {
        var data = Ext.Array.map(classes, function(cls) {
            return this.createLinkRecord(cls);
        }, this);

        return Ext.create('Docs.view.HoverMenuButton', {
            text: text,
            cls: 'icon-subclass',
            showCount: true,
            store: this.createStore(data)
        });
    },

    // creates store tha holds link records
    createStore: function(records) {
        var store = Ext.create('Ext.data.Store', {
            fields: ['id', 'cls', 'url', 'label', 'inherited', 'static']
        });
        store.add(records);
        return store;
    },

    // Creates link object referencing a class (and optionally a class member)
    createLinkRecord: function(cls, member) {
        return {
            cls: cls,
            url: member ? cls+"-"+member.tagname+"-"+member.name : cls,
            label: member ? ((member.name === "constructor") ? cls : member.name) : cls,
            inherited: member ? member.owner !== cls : false,
            'static': member ? member['static'] : false
        };
    },

    /**
     * Hides or unhides inherited members.
     * @param {Boolean} hide
     */
    hideInherited: function(hide) {
        Docs.Settings.set("hideInherited", hide);

        // show/hide all inherited members
        Ext.Array.forEach(Ext.query('.member.inherited'), function(m) {
            Ext.get(m).setStyle({display: hide ? 'none' : 'block'});
        });

        // Remove all first-child classes
        Ext.Array.forEach(Ext.query('.member.first-child'), function(m) {
            Ext.get(m).removeCls('first-child');
        });

        Ext.Array.forEach(['cfg', 'property', 'method', 'event'], function(type) {
            var sectionId = '#m-' + type;

            // Hide the section completely if all items in it are inherited
            if (Ext.query(sectionId+' .member.not-inherited').length === 0) {
                var section = Ext.query(sectionId)[0];
                section && Ext.get(section).setStyle({display: hide ? 'none' : 'block'});
            }

            // add first-child class to first member in subsection
            Ext.Array.forEach(Ext.query(sectionId+" .subsection"), function(subsection) {
                var subsectionMembers = Ext.query('.member' + (hide ? ".not-inherited" : ""), subsection);
                if (subsectionMembers.length > 0) {
                    Ext.get(subsectionMembers[0]).addCls('first-child');
                    // make sure subsection is visible
                    Ext.get(subsection).setStyle({display: 'block'});
                }
                else {
                    // Hide subsection completely if empty
                    Ext.get(subsection).setStyle({display: 'none'});
                }
            }, this);

            if (this.memberButtons[type]) {
                var store = this.memberButtons[type].getStore();
                if (hide) {
                    store.filterBy(function(m) { return !m.get("inherited"); });
                }
                else {
                    store.clearFilter();
                }
            }
        }, this);
    },

    filterMembers: function(search) {
        var isSearch = search.length > 0;

        // Hide the class documentation
        Ext.Array.forEach(Ext.query('.doc-contents, .hierarchy'), function(el) {
            Ext.get(el).setStyle({display: isSearch ? 'none' : 'block'});
        });

        // Hide members who's name doesn't match with the search string
        var re = new RegExp(Ext.String.escapeRegex(search), "i");
        this.eachMember(function(m) {
            var el = Ext.get(m.tagname + "-" + m.name);
            el.setStyle({display: (re.test(m.name) || !isSearch) ? 'block' : 'none'});
        }, this);
    },

    // Loops through each member of class
    eachMember: function(callback, scope) {
        Ext.Array.forEach(['members', 'statics'], function(group) {
            Ext.Object.each(this.docClass[group], function(type, members) {
                Ext.Array.forEach(members, callback, scope);
            }, this);
        }, this);
    }
});
